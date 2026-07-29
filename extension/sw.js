// AI Session Extractor - Service Worker v5.1
// Renamed from background.js to force Chrome cache invalidation

const AI_URL_PATTERNS = [
  "gemini.google.com", "chatgpt.com", "chat.openai.com", "claude.ai",
  "chat.deepseek.com", "copilot.microsoft.com", "grok.com",
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

function keepAlive() { if (aliveTimer) clearInterval(aliveTimer); aliveTimer = setInterval(() => {}, 20000); }
function stopKeepAlive() { if (aliveTimer) { clearInterval(aliveTimer); aliveTimer = null; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function addLog(msg) { batchState.log.push({ time: Date.now(), msg }); if (batchState.log.length > 300) batchState.log = batchState.log.slice(-300); }

function getChatLinksSelector(name) {
  const map = {
    "Gemini": '[data-test-id="conversation"] a, a[href*="/app/"]',
    "ChatGPT": 'a[href*="/c/"]',
    "Claude": 'a[href*="/chat/"]',
    "DeepSeek": 'a[href*="/chat/"]',
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
  return map[name] || 'a[href*="/chat/"], a[href*="/c/"]';
}

chrome.runtime.onInstalled.addListener(() => {
  try { chrome.contextMenus.removeAll(() => { try { chrome.contextMenus.create({ id: "ext-conv", title: "Extract AI Conversation", contexts: ["page"], documentUrlPatterns: AI_URL_PATTERNS.map(p => "https://" + p + "/*") }); } catch (e) {} }); } catch (e) {}
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "ext-conv" || !tab) return;
  try { await ensureCS(tab.id); const r = await sendTab(tab.id, { action: "extract" }); if (r) { const { history = [] } = await chrome.storage.local.get("history"); history.unshift({ ...r, savedAt: new Date().toISOString() }); await chrome.storage.local.set({ history: history.slice(0, 100) }); } } catch (e) {}
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  function respond(data) { try { sendResponse(data); } catch (e) {} }
  const action = request.action;

  switch (action) {
    case "discoverTabs": {
      keepAlive();
      discoverAITabs().then(tabs => { respond(tabs); stopKeepAlive(); }).catch(() => { respond([]); stopKeepAlive(); });
      return true;
    }
    case "startBatch": {
      if (batchState.running) { respond({ error: "Batch already running" }); return true; }
      startBatchExtraction([request.tabId]); respond({ started: true }); return true;
    }
    case "startMultiBatch": {
      if (batchState.running) { respond({ error: "Batch already running" }); return true; }
      discoverAITabs().then(tabs => { if (!tabs || tabs.length === 0) { respond({ error: "No AI tabs open" }); return; } startBatchExtraction(tabs.map(t => t.id)); respond({ started: true, tabCount: tabs.length }); }).catch(e => respond({ error: e.message }));
      return true;
    }
    case "dumpAllDOMs": {
      keepAlive();
      discoverAITabs().then(tabs => { if (!tabs || tabs.length === 0) { respond({ error: "No AI tabs open" }); stopKeepAlive(); return; } dumpAllDOMs(tabs).then(d => { respond({ downloaded: d.length > 0, downloads: d }); stopKeepAlive(); }).catch(e => { respond({ error: e.message }); stopKeepAlive(); }); }).catch(e => { respond({ error: e.message }); stopKeepAlive(); });
      return true;
    }
    case "cancelBatch": { batchState.cancelled = true; respond({ cancelled: true }); return true; }
    case "getBatchProgress": {
      respond({ running: batchState.running, done: batchState.done, phase: batchState.phase, totalTabs: batchState.totalTabs, currentTab: batchState.currentTab, currentPlatform: batchState.currentPlatform, currentChatTitle: batchState.currentChatTitle, totalChats: batchState.totalChats, currentChat: batchState.currentChat, successCount: batchState.conversations.length, failedCount: batchState.failedCount, log: batchState.log.slice(-40), error: batchState.error });
      return true;
    }
    case "getBatchResults": {
      if (batchState.conversations.length > 0) { respond({ platform: "multi", exportedAt: new Date().toISOString(), conversationCount: batchState.conversations.length, totalMessages: batchState.conversations.reduce((s, c) => s + (c.messageCount || 0), 0), failedCount: batchState.failedCount, conversations: batchState.conversations }); } else { respond(null); }
      return true;
    }
    case "saveSession": { (async () => { try { const { history = [] } = await chrome.storage.local.get("history"); history.unshift({ ...request.data, savedAt: new Date().toISOString() }); await chrome.storage.local.set({ history: history.slice(0, 100) }); respond({ saved: true }); } catch (e) { respond({ error: e.message }); } })(); return true; }
    case "getHistory": { (async () => { try { const { history = [] } = await chrome.storage.local.get("history"); respond(history); } catch (e) { respond([]); } })(); return true; }
    case "clearHistory": { chrome.storage.local.set({ history: [] }).then(() => respond({ cleared: true })); return true; }
    default: respond({ error: "Unknown: " + action }); return true;
  }
});

async function discoverAITabs() {
  const allTabs = await chrome.tabs.query({});
  const aiTabs = [];
  for (const tab of allTabs) {
    const url = tab.url || ""; if (!url.startsWith("http")) continue;
    for (const p of AI_URL_PATTERNS) {
      if (url.includes(p)) { let name = p.split(".")[0]; try { await ensureCS(tab.id); const ping = await sendTab(tab.id, { action: "ping" }); if (ping && ping.platformName) name = ping.platformName; } catch (e) {} aiTabs.push({ id: tab.id, url, title: tab.title || "", platform: name }); break; }
    }
  }
  return aiTabs;
}

async function dumpAllDOMs(tabs) {
  const downloads = [];
  for (const tab of tabs) {
    try {
      await ensureCS(tab.id); await sleep(400);
      let dump = null;
      for (let a = 0; a < 3 && !dump; a++) { try { dump = await sendTab(tab.id, { action: "dumpDOM" }); } catch (e) { if (a < 2) { await sleep(1000); await ensureCS(tab.id); await sleep(400); } } }
      if (!dump) continue;
      const platform = (dump.meta && dump.meta.platform) || tab.platform || "unknown";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = "dom-dump-" + platform + "-" + stamp + ".json";
      try { const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" }); const durl = URL.createObjectURL(blob); await chrome.downloads.download({ url: durl, filename, saveAs: false }); setTimeout(() => { try { URL.revokeObjectURL(durl); } catch (e) {} }, 60000); } catch (e) {}
      downloads.push({ tabId: tab.id, platform, hostname: (dump.meta && dump.meta.host) || "", filename, messageSelectorCount: Object.keys(dump.messages || {}).length, customElementCount: (dump.customElements || []).length, url: tab.url });
    } catch (e) {}
  }
  return downloads;
}

async function startBatchExtraction(tabIds) {
  keepAlive();
  batchState = { running: true, cancelled: false, phase: "collecting", totalTabs: tabIds.length, currentTab: 0, currentPlatform: "", currentChatTitle: "", totalChats: 0, currentChat: 0, conversations: [], failedCount: 0, log: [], done: false, error: null };
  try {
    for (let t = 0; t < tabIds.length; t++) {
      if (batchState.cancelled) { addLog("⛔ Cancelled."); break; }
      const tabId = tabIds[t]; batchState.currentTab = t + 1;
      let tabInfo; try { tabInfo = await chrome.tabs.get(tabId); } catch (e) { addLog("⚠️ Tab closed."); continue; }
      await ensureCS(tabId); await sleep(400);
      let ping; try { ping = await sendTab(tabId, { action: "ping" }); } catch (e) { addLog("⚠️ Can't reach tab."); continue; }
      const pName = (ping && ping.platformName) || "Unknown"; batchState.currentPlatform = pName;
      addLog("\n🌐 [Tab " + (t+1) + "/" + tabIds.length + "] " + pName);
      let chatList; try { chatList = await sendTab(tabId, { action: "collectAllChats" }); } catch (e) {}
      if (!chatList || !chatList.chats || chatList.chats.length === 0) {
        addLog("  ℹ️ No sidebar. Extracting current...");
        batchState.totalChats++; batchState.currentChat = batchState.totalChats; batchState.currentChatTitle = "Current";
        try { const conv = await sendTab(tabId, { action: "extract" }); if (conv && conv.messages && conv.messages.length > 0) { conv.sidebarTitle = conv.title || "Current"; batchState.conversations.push(conv); addLog("  ✅ " + conv.messages.length + " msgs"); } else { addLog("  ⚠️ No msgs"); batchState.failedCount++; } } catch (e) { addLog("  ❌ " + e.message); batchState.failedCount++; }
        continue;
      }
      const total = chatList.chats.length; addLog("  📋 " + total + " conversations");
      for (let i = 0; i < total; i++) {
        if (batchState.cancelled) break;
        const chat = chatList.chats[i]; batchState.totalChats++; batchState.currentChat = batchState.totalChats; batchState.currentChatTitle = chat.title;
        addLog("  📂 [" + (i+1) + "/" + total + "] " + (chat.title.length > 40 ? chat.title.substring(0,40)+"..." : chat.title));
        try {
          await chrome.scripting.executeScript({ target: { tabId }, func: (url, sel) => { const links = document.querySelectorAll(sel); for (const l of links) { const h = l.getAttribute("href") || l.href || ""; if (h === url || l.href === url || url.endsWith(h)) { l.click(); return; } } window.location.href = url; }, args: [chat.url, getChatLinksSelector(pName)] });
          await sleep(3000); await ensureCS(tabId); await sleep(600);
          let wr; try { wr = await sendTab(tabId, { action: "waitForContent", maxWait: 12000 }); } catch (e) { await sleep(2000); await ensureCS(tabId); await sleep(500); try { wr = await sendTab(tabId, { action: "waitForContent", maxWait: 10000 }); } catch (e2) { addLog("    ⚠️ Skipped"); batchState.failedCount++; continue; } }
          if (!wr || !wr.ready) { addLog("    ⚠️ Timeout"); batchState.failedCount++; continue; }
          const conv = await sendTab(tabId, { action: "extract" });
          if (conv && conv.messages && conv.messages.length > 0) { conv.chatId = chat.id; conv.sidebarTitle = chat.title; batchState.conversations.push(conv); addLog("    ✅ " + conv.messages.length + " msgs"); } else { addLog("    ⚠️ No msgs"); batchState.failedCount++; }
        } catch (e) { addLog("    ❌ " + e.message); batchState.failedCount++; try { await ensureCS(tabId); } catch (_) {} }
        await sleep(800);
      }
    }
    const tm = batchState.conversations.reduce((s, c) => s + (c.messageCount || 0), 0);
    addLog("\n🎉 " + batchState.conversations.length + " chats, " + tm + " msgs" + (batchState.failedCount > 0 ? ", " + batchState.failedCount + " failed" : ""));
  } catch (e) { batchState.error = e.message; addLog("❌ Fatal: " + e.message); }
  finally { batchState.running = false; batchState.done = true; batchState.phase = "done"; stopKeepAlive(); }
}

async function ensureCS(tabId) { try { await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }); await sleep(200); } catch (e) {} }
async function sendTab(tabId, msg, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try { return await chrome.tabs.sendMessage(tabId, msg); }
    catch (e) {
      const err = (e.message || "").toLowerCase();
      if (err.includes("channel") || err.includes("establish") || err.includes("receiving")) { if (i < retries) { await sleep(1200); await ensureCS(tabId); await sleep(500); continue; } }
      if (i < retries) { await sleep(800); await ensureCS(tabId); await sleep(400); continue; }
      throw e;
    }
  }
}

console.log("[AI Session Extractor] Worker v5.1 loaded OK");
