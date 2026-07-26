// ============================================================
// AI Session Extractor - Background Service Worker v4.1b
// Added: dumpAllDOMs action to scrape all open AI tabs at once
// ============================================================

const AI_URL_PATTERNS = [
  "gemini.google.com", "chatgpt.com", "chat.openai.com", "claude.ai",
  "chat.deepseek.com", "copilot.microsoft.com", "grok.com", "x.com/i/grok",
  "kimi.moonshot.cn", "meta.ai", "hailuoai.com", "minimax.io",
  "manus.im", "manus.app", "z.ai", "perplexity.ai", "poe.com",
  "chat.mistral.ai", "chatglm.cn", "tongyi.aliyun.com", "yiyan.baidu.com",
];

let batchState = {
  running: false, cancelled: false, phase: "idle",
  totalTabs: 0, currentTab: 0, currentPlatform: "", currentChatTitle: "",
  totalChats: 0, currentChat: 0,
  conversations: [], failedCount: 0, log: [], done: false, error: null,
};

// ---- Install ----
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "extract-conversation", title: "Extract AI Conversation", contexts: ["page"],
        documentUrlPatterns: AI_URL_PATTERNS.map(p => `https://${p}/*`),
      });
    });
  } catch (e) { console.log("[BG] Context menu setup skipped:", e.message); }
});

// ---- Context Menu ----
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "extract-conversation" && tab) {
    try {
      await ensureContentScript(tab.id);
      const result = await sendToTab(tab.id, { action: "extract" });
      if (result) {
        const { history = [] } = await chrome.storage.local.get("history");
        history.unshift({ ...result, savedAt: new Date().toISOString() });
        await chrome.storage.local.set({ history: history.slice(0, 100) });
      }
    } catch (e) { console.error("[BG] Context menu extract failed:", e); }
  }
});

// ============================================================
// MESSAGE HANDLER
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "discoverTabs": {
      discoverAITabs().then(tabs => sendResponse(tabs));
      return true;
    }

    case "startBatch": {
      if (batchState.running) { sendResponse({ error: "Batch already running" }); return true; }
      startBatchExtraction([request.tabId]);
      sendResponse({ started: true });
      break;
    }

    case "startMultiBatch": {
      if (batchState.running) { sendResponse({ error: "Batch already running" }); return true; }
      (async () => {
        const tabs = await discoverAITabs();
        if (tabs.length === 0) { sendResponse({ error: "No AI tabs found open" }); return; }
        startBatchExtraction(tabs.map(t => t.id));
        sendResponse({ started: true, tabCount: tabs.length });
      })();
      return true;
    }

    case "dumpAllDOMs": {
      (async () => {
        const tabs = await discoverAITabs();
        if (tabs.length === 0) { sendResponse({ error: "No AI tabs found open" }); return; }
        const downloads = await dumpAllDOMs(tabs);
        sendResponse({ downloaded: downloads.length > 0, downloads });
      })();
      return true;
    }

    case "cancelBatch": {
      batchState.cancelled = true;
      sendResponse({ cancelled: true });
      break;
    }

    case "getBatchProgress": {
      sendResponse({
        running: batchState.running, done: batchState.done, phase: batchState.phase,
        totalTabs: batchState.totalTabs, currentTab: batchState.currentTab,
        currentPlatform: batchState.currentPlatform, currentChatTitle: batchState.currentChatTitle,
        totalChats: batchState.totalChats, currentChat: batchState.currentChat,
        successCount: batchState.conversations.length, failedCount: batchState.failedCount,
        log: batchState.log.slice(-40), error: batchState.error,
      });
      break;
    }

    case "getBatchResults": {
      if (batchState.conversations.length > 0) {
        sendResponse({
          platform: "multi", exportedAt: new Date().toISOString(),
          conversationCount: batchState.conversations.length,
          totalMessages: batchState.conversations.reduce((s, c) => s + c.messageCount, 0),
          failedCount: batchState.failedCount,
          conversations: batchState.conversations,
        });
      } else { sendResponse(null); }
      break;
    }

    case "saveSession": {
      (async () => {
        const { history = [] } = await chrome.storage.local.get("history");
        history.unshift({ ...request.data, savedAt: new Date().toISOString() });
        await chrome.storage.local.set({ history: history.slice(0, 100) });
        sendResponse({ saved: true });
      })();
      return true;
    }
    case "getHistory": {
      (async () => { const { history = [] } = await chrome.storage.local.get("history"); sendResponse(history); })();
      return true;
    }
    case "clearHistory": {
      chrome.storage.local.set({ history: [] }).then(() => sendResponse({ cleared: true }));
      return true;
    }

    default:
      sendResponse({ error: "Unknown action" });
  }
  return true;
});

// ============================================================
// DISCOVER OPEN AI TABS
// ============================================================
async function discoverAITabs() {
  const allTabs = await chrome.tabs.query({});
  const aiTabs = [];
  for (const tab of allTabs) {
    const url = tab.url || "";
    for (const pattern of AI_URL_PATTERNS) {
      if (url.includes(pattern)) {
        let platformName = pattern.split(".")[0];
        try {
          await ensureContentScript(tab.id);
          const ping = await sendToTab(tab.id, { action: "ping" });
          if (ping) platformName = ping.platformName || platformName;
        } catch (e) {}
        aiTabs.push({ id: tab.id, url, title: tab.title || "", platform: platformName });
        break;
      }
    }
  }
  return aiTabs;
}

// ============================================================
// DUMP DOMs OF ALL AI TABS
// ============================================================
async function dumpAllDOMs(tabs) {
  const downloads = [];
  for (const tab of tabs) {
    try {
      await ensureContentScript(tab.id);
      await sleep(500);

      let dump = null;
      let attempts = 0;
      while (attempts < 3) {
        attempts++;
        try {
          dump = await sendToTab(tab.id, { action: "dumpDOM" });
          if (dump) break;
        } catch (e) {
          if (attempts < 3) { await sleep(1000); await ensureContentScript(tab.id); await sleep(500); }
        }
      }

      if (!dump) continue;

      // Download as JSON file
      const platform = dump.meta?.platform || tab.platform || "unknown";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `dom-dump-${platform}-${stamp}.json`;
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });

      const dataUrl = await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.readAsDataURL(blob);
      });

      const downloadId = await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
      downloads.push({
        tabId: tab.id, platform, hostname: dump.meta?.host || new URL(tab.url).hostname,
        filename, downloadId,
        messageSelectorCount: Object.keys(dump.messages || {}).length,
        customElementCount: dump.customElements?.length || 0,
        url: tab.url,
      });
      console.log(`[BG] DOM dump downloaded: ${filename}`);
    } catch (e) {
      console.error(`[BG] Failed to dump tab ${tab.id}:`, e);
    }
  }
  return downloads;
}

// ============================================================
// MULTI-TAB BATCH ENGINE
// ============================================================
async function startBatchExtraction(tabIds) {
  batchState = {
    running: true, cancelled: false, phase: "collecting",
    totalTabs: tabIds.length, currentTab: 0, currentPlatform: "", currentChatTitle: "",
    totalChats: 0, currentChat: 0,
    conversations: [], failedCount: 0, log: [], done: false, error: null,
  };

  try {
    for (let t = 0; t < tabIds.length; t++) {
      if (batchState.cancelled) { addLog("⛔ Cancelled."); break; }

      const tabId = tabIds[t];
      batchState.currentTab = t + 1;
      batchState.phase = "collecting";

      let tabInfo;
      try { tabInfo = await chrome.tabs.get(tabId); } catch (e) { addLog(`⚠️ Tab ${tabId} closed, skipping.`); continue; }

      await ensureContentScript(tabId);
      await sleep(500);

      let ping;
      try { ping = await sendToTab(tabId, { action: "ping" }); } catch (e) { addLog(`⚠️ Can't reach tab: ${tabInfo.url}`); continue; }
      const platformName = ping?.platformName || "Unknown";
      batchState.currentPlatform = platformName;
      addLog(`\n🌐 [Tab ${t + 1}/${tabIds.length}] ${platformName} — ${tabInfo.url}`);

      let chatList;
      try { chatList = await sendToTab(tabId, { action: "collectAllChats" }); }
      catch (e) { addLog(`  ❌ Failed to collect chats: ${e.message}`); batchState.failedCount++; continue; }

      if (!chatList || !chatList.chats || chatList.chats.length === 0) {
        addLog(`  ℹ️ No sidebar history found. Extracting current conversation...`);
        batchState.phase = "extracting";
        batchState.totalChats++; batchState.currentChat = batchState.totalChats;
        batchState.currentChatTitle = "Current conversation";

        try {
          const conv = await sendToTab(tabId, { action: "extract" });
          if (conv && conv.messages && conv.messages.length > 0) {
            conv.sidebarTitle = conv.title || "Current conversation";
            batchState.conversations.push(conv);
            addLog(`  ✅ ${conv.messages.length} messages`);
          } else { addLog(`  ⚠️ No messages found`); batchState.failedCount++; }
        } catch (e) { addLog(`  ❌ ${e.message}`); batchState.failedCount++; }
        continue;
      }

      const total = chatList.chats.length;
      addLog(`  📋 Found ${total} conversations. Extracting...`);
      batchState.phase = "extracting";

      for (let i = 0; i < total; i++) {
        if (batchState.cancelled) break;

        const chat = chatList.chats[i];
        batchState.totalChats++; batchState.currentChat = batchState.totalChats;
        batchState.currentChatTitle = chat.title;
        const shortTitle = chat.title.length > 45 ? chat.title.substring(0, 45) + "..." : chat.title;
        addLog(`  📂 [${i + 1}/${total}] ${shortTitle}`);

        try {
          // Navigate via executeScript to avoid channel-closed errors
          await chrome.scripting.executeScript({
            target: { tabId },
            func: (url, chatLinksSelector) => {
              const links = document.querySelectorAll(chatLinksSelector);
              for (const link of links) {
                const href = link.getAttribute("href") || link.href || "";
                if (href === url || link.href === url || url.endsWith(href)) {
                  link.click(); return;
                }
              }
              window.location.href = url;
            },
            args: [chat.url, getChatLinksSelector(platformName)],
          });

          await sleep(3000);
          await ensureContentScript(tabId);
          await sleep(800);

          let waitResult;
          try { waitResult = await sendToTab(tabId, { action: "waitForContent", maxWait: 12000 }); }
          catch (e) {
            await sleep(2000); await ensureContentScript(tabId); await sleep(500);
            try { waitResult = await sendToTab(tabId, { action: "waitForContent", maxWait: 10000 }); }
            catch (e2) { addLog(`    ⚠️ Skipped (content script unreachable)`); batchState.failedCount++; continue; }
          }

          if (!waitResult || !waitResult.ready) {
            addLog(`    ⚠️ Skipped (content didn't load in time)`); batchState.failedCount++; continue;
          }

          const conv = await sendToTab(tabId, { action: "extract" });
          if (conv && conv.messages && conv.messages.length > 0) {
            conv.chatId = chat.id; conv.sidebarTitle = chat.title;
            batchState.conversations.push(conv);
            addLog(`    ✅ ${conv.messages.length} messages`);
          } else { addLog(`    ⚠️ No messages found`); batchState.failedCount++; }
        } catch (e) {
          addLog(`    ❌ ${e.message}`); batchState.failedCount++;
          try { await ensureContentScript(tabId); } catch (_) {}
        }
        await sleep(1000);
      }
    }

    const totalMsgs = batchState.conversations.reduce((s, c) => s + c.messageCount, 0);
    addLog(`\n🎉 Complete! ${batchState.conversations.length} chats, ${totalMsgs} messages total. ${batchState.failedCount > 0 ? batchState.failedCount + " failed." : ""}`);
  } catch (e) {
    batchState.error = e.message;
    addLog(`❌ Fatal: ${e.message}`);
  } finally {
    batchState.running = false; batchState.done = true; batchState.phase = "done";
  }
}

// ============================================================
// HELPERS
// ============================================================
function getChatLinksSelector(platformName) {
  const map = {
    "Gemini": '[data-test-id="conversation"] a, a[href*="/app/"]',
    "ChatGPT": 'nav a[href*="/c/"], a[href*="/c/"]',
    "Claude": 'a[href*="/chat/"]',
    "DeepSeek": 'a[href*="/chat/"]',
    "Copilot": 'a[href*="/search/"]',
    "Grok": 'a[href*="/chat/"]',
    "Kimi": 'a[href*="/chat/"]',
    "Meta AI": 'a[href*="/chat/"]',
    "MiniMax": 'a[href*="/chat/"]',
    "Manus": 'a[href*="/task/"], a[href*="/chat/"]',
    "Zai": 'a[href*="/chat/"]',
    "Perplexity": 'a[href*="/search/"], a[href*="/thread/"]',
    "Poe": 'a[href*="/chat/"]',
    "Mistral": 'a[href*="/chat/"]',
  };
  return map[platformName] || 'a[href*="/chat/"], a[href*="/c/"], a[href*="/conversation/"]';
}

function addLog(msg) {
  batchState.log.push({ time: Date.now(), msg });
  if (batchState.log.length > 300) batchState.log = batchState.log.slice(-300);
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await sleep(300);
  } catch (e) { console.log("[BG] ensureContentScript failed:", e.message); }
}

async function sendToTab(tabId, msg, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch (e) {
      const errMsg = e.message || "";
      if (errMsg.includes("message channel closed") || errMsg.includes("Could not establish connection") || errMsg.includes("Receiving end does not exist")) {
        if (i < retries) { await sleep(1500); await ensureContentScript(tabId); await sleep(800); continue; }
      }
      if (i < retries) { await sleep(1000); await ensureContentScript(tabId); await sleep(500); }
      else throw e;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

console.log("[AI Session Extractor] Background v4.1b loaded (dumpAllDOMs added)");
