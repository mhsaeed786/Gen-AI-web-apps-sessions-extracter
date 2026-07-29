// ============================================================
// AI Session Extractor - Background Service Worker v5.0
// Clean rewrite: no undefined references, proper scoping
// ============================================================

const AI_URL_PATTERNS = [
  "gemini.google.com", "chatgpt.com", "chat.openai.com", "claude.ai",
  "chat.deepseek.com", "copilot.microsoft.com", "grok.com", "x.com/i/grok",
  "kimi.moonshot.cn", "www.kimi.com", "meta.ai", "hailuoai.com",
  "minimax.io", "agent.minimax.io", "manus.im", "manus.app",
  "chat.z.ai", "z.ai", "perplexity.ai", "poe.com",
  "chat.mistral.ai", "chatglm.cn", "tongyi.aliyun.com",
  "chat.qwen.ai", "coder.qwen.ai", "pi.ai", "jules.google.com",
];

let aliveTimer = null;
let batchState = {
  running: false, cancelled: false, phase: "idle",
  totalTabs: 0, currentTab: 0, currentPlatform: "", currentChatTitle: "",
  totalChats: 0, currentChat: 0,
  conversations: [], failedCount: 0, log: [], done: false, error: null,
};

// ---- Helpers (module scope) ----
function keepAlive() {
  if (aliveTimer) clearInterval(aliveTimer);
  aliveTimer = setInterval(() => {}, 20000);
}
function stopKeepAlive() {
  if (aliveTimer) { clearInterval(aliveTimer); aliveTimer = null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addLog(msg) {
  batchState.log.push({ time: Date.now(), msg });
  if (batchState.log.length > 300) batchState.log = batchState.log.slice(-300);
}

function getChatLinksSelector(platformName) {
  const map = {
    "Gemini": '[data-test-id="conversation"] a, a[href*="/app/"]',
    "ChatGPT": 'nav a[href*="/c/"], a[href*="/c/"]',
    "Claude": 'a[href*="/chat/"]',
    "DeepSeek": 'a[href*="/chat/"]',
    "Copilot": 'a[href*="/search/"]',
    "Grok": 'a[href*="/c/"], a[href*="/chat/"]',
    "Kimi": 'a[href*="/chat/"]',
    "Meta AI": 'a[href*="/chat/"], a[href*="/prompt/"]',
    "MiniMax": 'a[href*="/chat/"], a[href*="/agent/"]',
    "Manus": 'a[href*="/task/"], a[href*="/chat/"]',
    "Zai": 'a[href*="/c/"]',
    "Perplexity": 'a[href*="/search/"], a[href*="/thread/"]',
    "Poe": 'a[href*="/chat/"]',
    "Mistral": 'a[href*="/chat/"]',
    "Qwen": 'a[href*="/c/"], a[href*="/chat/"]',
  };
  return map[platformName] || 'a[href*="/chat/"], a[href*="/c/"], a[href*="/conversation/"]';
}

// ---- Install ----
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.removeAll(() => {
      try {
        chrome.contextMenus.create({
          id: "extract-conversation", title: "Extract AI Conversation", contexts: ["page"],
          documentUrlPatterns: AI_URL_PATTERNS.map(p => `https://${p}/*`),
        });
      } catch (e) {}
    });
  } catch (e) {}
});

// ---- Context Menu ----
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "extract-conversation" || !tab) return;
  try {
    await ensureContentScript(tab.id);
    const result = await sendToTab(tab.id, { action: "extract" });
    if (result) {
      const { history = [] } = await chrome.storage.local.get("history");
      history.unshift({ ...result, savedAt: new Date().toISOString() });
      await chrome.storage.local.set({ history: history.slice(0, 100) });
    }
  } catch (e) {}
});

// ============================================================
// MESSAGE HANDLER
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const action = request.action;

  // Helper to safely respond
  function respond(data) {
    try { sendResponse(data); } catch (e) {}
  }

  switch (action) {
    case "discoverTabs": {
      keepAlive();
      discoverAITabs()
        .then(tabs => { respond(tabs); stopKeepAlive(); })
        .catch(e => { respond([]); stopKeepAlive(); });
      return true;
    }

    case "startBatch": {
      if (batchState.running) { respond({ error: "Batch already running" }); return true; }
      startBatchExtraction([request.tabId]);
      respond({ started: true });
      return true;
    }

    case "startMultiBatch": {
      if (batchState.running) { respond({ error: "Batch already running" }); return true; }
      discoverAITabs().then(tabs => {
        if (!tabs || tabs.length === 0) { respond({ error: "No AI tabs found open" }); return; }
        startBatchExtraction(tabs.map(t => t.id));
        respond({ started: true, tabCount: tabs.length });
      }).catch(e => { respond({ error: e.message }); });
      return true;
    }

    case "dumpAllDOMs": {
      keepAlive();
      discoverAITabs().then(tabs => {
        if (!tabs || tabs.length === 0) { respond({ error: "No AI tabs found open" }); stopKeepAlive(); return; }
        dumpAllDOMs(tabs).then(downloads => {
          respond({ downloaded: downloads.length > 0, downloads });
          stopKeepAlive();
        }).catch(e => { respond({ error: e.message }); stopKeepAlive(); });
      }).catch(e => { respond({ error: e.message }); stopKeepAlive(); });
      return true;
    }

    case "cancelBatch": {
      batchState.cancelled = true;
      respond({ cancelled: true });
      return true;
    }

    case "getBatchProgress": {
      respond({
        running: batchState.running, done: batchState.done, phase: batchState.phase,
        totalTabs: batchState.totalTabs, currentTab: batchState.currentTab,
        currentPlatform: batchState.currentPlatform, currentChatTitle: batchState.currentChatTitle,
        totalChats: batchState.totalChats, currentChat: batchState.currentChat,
        successCount: batchState.conversations.length, failedCount: batchState.failedCount,
        log: batchState.log.slice(-40), error: batchState.error,
      });
      return true;
    }

    case "getBatchResults": {
      if (batchState.conversations.length > 0) {
        respond({
          platform: "multi", exportedAt: new Date().toISOString(),
          conversationCount: batchState.conversations.length,
          totalMessages: batchState.conversations.reduce((s, c) => s + (c.messageCount || 0), 0),
          failedCount: batchState.failedCount,
          conversations: batchState.conversations,
        });
      } else {
        respond(null);
      }
      return true;
    }

    case "saveSession": {
      (async () => {
        try {
          const { history = [] } = await chrome.storage.local.get("history");
          history.unshift({ ...request.data, savedAt: new Date().toISOString() });
          await chrome.storage.local.set({ history: history.slice(0, 100) });
          respond({ saved: true });
        } catch (e) { respond({ error: e.message }); }
      })();
      return true;
    }

    case "getHistory": {
      (async () => {
        try {
          const { history = [] } = await chrome.storage.local.get("history");
          respond(history);
        } catch (e) { respond([]); }
      })();
      return true;
    }

    case "clearHistory": {
      chrome.storage.local.set({ history: [] }).then(() => respond({ cleared: true }));
      return true;
    }

    default:
      respond({ error: "Unknown action: " + action });
      return true;
  }
});

// ============================================================
// DISCOVER OPEN AI TABS
// ============================================================
async function discoverAITabs() {
  const allTabs = await chrome.tabs.query({});
  const aiTabs = [];
  for (const tab of allTabs) {
    const url = tab.url || "";
    if (!url.startsWith("http")) continue;
    for (const pattern of AI_URL_PATTERNS) {
      if (url.includes(pattern)) {
        let platformName = pattern.split(".")[0];
        try {
          await ensureContentScript(tab.id);
          const ping = await sendToTab(tab.id, { action: "ping" });
          if (ping && ping.platformName) platformName = ping.platformName;
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
      await sleep(400);

      let dump = null;
      let attempts = 0;
      while (attempts < 3 && !dump) {
        attempts++;
        try {
          dump = await sendToTab(tab.id, { action: "dumpDOM" });
        } catch (e) {
          if (attempts < 3) { await sleep(1000); await ensureContentScript(tab.id); await sleep(400); }
        }
      }

      if (!dump) continue;

      const platform = (dump.meta && dump.meta.platform) || tab.platform || "unknown";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `dom-dump-${platform}-${stamp}.json`;
      const json = JSON.stringify(dump, null, 2);

      // Service-worker safe download
      try {
        const blob = new Blob([json], { type: "application/json" });
        const dataUrl = URL.createObjectURL(blob);
        await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
        setTimeout(() => { try { URL.revokeObjectURL(dataUrl); } catch (e) {} }, 60000);
      } catch (dlErr) {
        console.error("[BG] Download failed:", dlErr);
      }

      downloads.push({
        tabId: tab.id, platform,
        hostname: (dump.meta && dump.meta.host) || new URL(tab.url).hostname,
        filename,
        messageSelectorCount: Object.keys(dump.messages || {}).length,
        customElementCount: (dump.customElements || []).length,
        url: tab.url,
      });
    } catch (e) {
      console.error("[BG] Failed to dump tab:", e);
    }
  }
  return downloads;
}

// ============================================================
// MULTI-TAB BATCH ENGINE
// ============================================================
async function startBatchExtraction(tabIds) {
  keepAlive();
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

      let tabInfo;
      try { tabInfo = await chrome.tabs.get(tabId); }
      catch (e) { addLog(`⚠️ Tab ${tabId} closed, skipping.`); continue; }

      await ensureContentScript(tabId);
      await sleep(400);

      let ping;
      try { ping = await sendToTab(tabId, { action: "ping" }); }
      catch (e) { addLog(`⚠️ Can't reach tab: ${tabInfo.url}`); continue; }

      const platformName = (ping && ping.platformName) || "Unknown";
      batchState.currentPlatform = platformName;
      addLog(`\n🌐 [Tab ${t + 1}/${tabIds.length}] ${platformName} — ${tabInfo.url}`);

      // Collect sidebar chats
      let chatList;
      try { chatList = await sendToTab(tabId, { action: "collectAllChats" }); }
      catch (e) { addLog(`  ❌ Failed to collect chats: ${e.message}`); }

      if (!chatList || !chatList.chats || chatList.chats.length === 0) {
        addLog(`  ℹ️ No sidebar history. Extracting current conversation...`);
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

      for (let i = 0; i < total; i++) {
        if (batchState.cancelled) break;

        const chat = chatList.chats[i];
        batchState.totalChats++; batchState.currentChat = batchState.totalChats;
        batchState.currentChatTitle = chat.title;
        const shortTitle = chat.title.length > 45 ? chat.title.substring(0, 45) + "..." : chat.title;
        addLog(`  📂 [${i + 1}/${total}] ${shortTitle}`);

        try {
          // Navigate via executeScript (no message channel issues)
          await chrome.scripting.executeScript({
            target: { tabId },
            func: (url, chatLinksSelector) => {
              const links = document.querySelectorAll(chatLinksSelector);
              for (const link of links) {
                const href = link.getAttribute("href") || link.href || "";
                if (href === url || link.href === url || url.endsWith(href)) {
                  link.click(); return true;
                }
              }
              window.location.href = url;
            },
            args: [chat.url, getChatLinksSelector(platformName)],
          });

          await sleep(3000);
          await ensureContentScript(tabId);
          await sleep(600);

          let waitResult;
          try { waitResult = await sendToTab(tabId, { action: "waitForContent", maxWait: 12000 }); }
          catch (e) {
            await sleep(2000);
            await ensureContentScript(tabId);
            await sleep(500);
            try { waitResult = await sendToTab(tabId, { action: "waitForContent", maxWait: 10000 }); }
            catch (e2) { addLog(`    ⚠️ Skipped (content unreachable)`); batchState.failedCount++; continue; }
          }

          if (!waitResult || !waitResult.ready) {
            addLog(`    ⚠️ Skipped (timeout)`); batchState.failedCount++; continue;
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
        await sleep(800);
      }
    }

    const totalMsgs = batchState.conversations.reduce((s, c) => s + (c.messageCount || 0), 0);
    addLog(`\n🎉 Done! ${batchState.conversations.length} chats, ${totalMsgs} messages. ${batchState.failedCount > 0 ? batchState.failedCount + " failed." : ""}`);
  } catch (e) {
    batchState.error = e.message;
    addLog(`❌ Fatal: ${e.message}`);
  } finally {
    batchState.running = false;
    batchState.done = true;
    batchState.phase = "done";
    stopKeepAlive();
  }
}

// ============================================================
// CONTENT SCRIPT INJECTION + MESSAGE SENDING
// ============================================================
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await sleep(200);
  } catch (e) {}
}

async function sendToTab(tabId, msg, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, msg);
      return resp;
    } catch (e) {
      const err = (e.message || "").toLowerCase();
      if (err.includes("message channel closed") || err.includes("could not establish") || err.includes("receiving end does not exist")) {
        if (i < retries) {
          await sleep(1200);
          await ensureContentScript(tabId);
          await sleep(500);
          continue;
        }
      }
      if (i < retries) {
        await sleep(800);
        await ensureContentScript(tabId);
        await sleep(400);
        continue;
      }
      throw e;
    }
  }
}

console.log("[AI Session Extractor] Background v5.0 loaded");
