// AI Session Extractor - Service Worker v6.0 (MV3 durable batches)
// Batch state lives in chrome.storage.session so it survives service-worker
// termination; an alarms-driven tick ("batchTick", every 0.5 min) resumes
// processing one chat per wake-up until the queue drains. The keepAlive
// interval is best-effort only — never relied upon for durability.

const AI_URL_PATTERNS = [
  "gemini.google.com", "chatgpt.com", "chat.openai.com", "claude.ai",
  "chat.deepseek.com", "copilot.microsoft.com", "grok.com",
  "kimi.moonshot.cn", "www.kimi.com", "meta.ai", "hailuoai.com",
  "minimax.io", "agent.minimax.io", "manus.im", "manus.app",
  "chat.z.ai", "z.ai", "perplexity.ai", "poe.com",
  "chat.mistral.ai", "chatglm.cn", "tongyi.aliyun.com",
  "chat.qwen.ai", "coder.qwen.ai", "pi.ai", "jules.google.com",
];

const BATCH_KEY = "batchState";
const BATCH_ALARM = "batchTick";
let aliveTimer = null;
let batchState = null;      // in-memory cache, hydrated from storage.session
let processing = false;     // re-entrancy guard for processNextJob

function freshState(tabIds) {
  return {
    running: true, cancelled: false, phase: "collecting",
    totalTabs: tabIds ? tabIds.length : 0,
    currentTab: 0, currentPlatform: "", currentChatTitle: "",
    totalChats: 0, currentChat: 0,
    conversations: [], failedCount: 0, warnedCount: 0, log: [],
    done: false, error: null,
    queue: tabIds ? tabIds.map(id => ({ type: "discover", tabId: id })) : [],
  };
}

// ---------- durability ----------
async function hydrateBatch() {
  if (batchState) return batchState;
  try { const o = await chrome.storage.session.get(BATCH_KEY); batchState = o[BATCH_KEY] || null; } catch (e) { batchState = null; }
  return batchState;
}
async function persistBatch() {
  if (!batchState) return;
  try { await chrome.storage.session.set({ [BATCH_KEY]: JSON.parse(JSON.stringify(batchState)) }); } catch (e) {}
}
async function wipeBatch() {
  batchState = null;
  try { await chrome.storage.session.remove(BATCH_KEY); } catch (e) {}
}
async function ensureBatchAlarm(active) {
  try {
    if (active) await chrome.alarms.create(BATCH_ALARM, { periodInMinutes: 0.5 });
    else await chrome.alarms.clear(BATCH_ALARM);
  } catch (e) {}
}

function keepAlive() { if (aliveTimer) clearInterval(aliveTimer); aliveTimer = setInterval(() => {}, 20000); }
function stopKeepAlive() { if (aliveTimer) { clearInterval(aliveTimer); aliveTimer = null; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addLog(msg) {
  if (!batchState) return;
  batchState.log.push({ time: Date.now(), msg });
  if (batchState.log.length > 300) batchState.log = batchState.log.slice(-300);
}
// Counted warning (surfaced in popup) instead of a silent catch
function addWarn(msg) { if (batchState) batchState.warnedCount++; addLog(msg); }

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

// ---------- startup resume ----------
// On every worker cold-start, hydrate any in-progress batch and make sure the
// tick alarm exists. The alarm itself drives the actual resume.
(async () => {
  const st = await hydrateBatch();
  if (st && st.running && !st.done && !st.cancelled) {
    addLog("🔄 Worker restarted — batch will resume on next tick.");
    await persistBatch();
    await ensureBatchAlarm(true);
  }
})();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== BATCH_ALARM) return;
  const st = await hydrateBatch();
  if (!st || !st.running || st.done || st.cancelled) { await ensureBatchAlarm(false); return; }
  keepAlive();
  await processNextJob();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "ext-conv" || !tab) return;
  try { await ensureCS(tab.id); const r = await sendTab(tab.id, { action: "extract" }); if (r) { const { history = [] } = await chrome.storage.local.get("history"); history.unshift({ ...r, savedAt: new Date().toISOString() }); await chrome.storage.local.set({ history: history.slice(0, 100) }); } else { console.warn("[SW] context-menu extract returned nothing"); } } catch (e) { console.warn("[SW] context-menu extract failed:", e.message); }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  function respond(data) { try { sendResponse(data); } catch (e) {} }
  const action = request.action;

  switch (action) {
    case "discoverTabs": {
      keepAlive();
      discoverAITabs().then(tabs => { respond(tabs); stopKeepAlive(); }).catch(e => { console.warn("[SW] discoverTabs:", e.message); respond([]); stopKeepAlive(); });
      return true;
    }
    case "startBatch": {
      if (batchState && batchState.running && !batchState.done) { respond({ error: "Batch already running" }); return true; }
      startBatchExtraction([request.tabId]); respond({ started: true }); return true;
    }
    case "startMultiBatch": {
      if (batchState && batchState.running && !batchState.done) { respond({ error: "Batch already running" }); return true; }
      discoverAITabs().then(tabs => { if (!tabs || tabs.length === 0) { respond({ error: "No AI tabs open" }); return; } startBatchExtraction(tabs.map(t => t.id)); respond({ started: true, tabCount: tabs.length }); }).catch(e => respond({ error: e.message }));
      return true;
    }
    case "resumeBatch": {
      (async () => {
        const st = await hydrateBatch();
        if (!st || !st.running || st.done) { respond({ error: "Nothing to resume" }); return; }
        st.cancelled = false; st.error = null;
        addLog("▶️ Resumed by user.");
        await persistBatch();
        await ensureBatchAlarm(true);
        keepAlive();
        processNextJob();
        respond({ resumed: true });
      })();
      return true;
    }
    case "discardBatch": {
      (async () => { await ensureBatchAlarm(false); stopKeepAlive(); await wipeBatch(); respond({ discarded: true }); })();
      return true;
    }
    case "dumpAllDOMs": {
      keepAlive();
      discoverAITabs().then(tabs => { if (!tabs || tabs.length === 0) { respond({ error: "No AI tabs open", dumped: 0, failed: 0 }); stopKeepAlive(); return; } dumpAllDOMs(tabs).then(d => { respond(d); stopKeepAlive(); }).catch(e => { respond({ error: e.message, dumped: 0, failed: 0 }); stopKeepAlive(); }); }).catch(e => { respond({ error: e.message, dumped: 0, failed: 0 }); stopKeepAlive(); });
      return true;
    }
    case "cancelBatch": {
      (async () => { if (batchState) { batchState.cancelled = true; await persistBatch(); } respond({ cancelled: true }); })();
      return true;
    }
    case "getBatchProgress": {
      (async () => {
        const st = await hydrateBatch();
        if (!st) { respond({ idle: true }); return; }
        respond({
          running: st.running, done: st.done, cancelled: !!st.cancelled,
          // resumable: interrupted mid-batch (worker died / browser restarted)
          resumable: st.running && !st.done && !st.cancelled && !processing,
          phase: st.phase, totalTabs: st.totalTabs, currentTab: st.currentTab,
          currentPlatform: st.currentPlatform, currentChatTitle: st.currentChatTitle,
          totalChats: st.totalChats, currentChat: st.currentChat,
          successCount: st.conversations.length, failedCount: st.failedCount,
          warnedCount: st.warnedCount || 0, pendingJobs: st.queue.length,
          log: st.log.slice(-40), error: st.error,
        });
      })();
      return true;
    }
    case "getBatchResults": {
      (async () => {
        const st = await hydrateBatch();
        if (st && st.conversations.length > 0) { respond({ platform: "multi", exportedAt: new Date().toISOString(), conversationCount: st.conversations.length, totalMessages: st.conversations.reduce((s, c) => s + (c.messageCount || 0), 0), failedCount: st.failedCount, conversations: st.conversations }); }
        else respond(null);
      })();
      return true;
    }
    case "saveSession": { (async () => { try { const { history = [] } = await chrome.storage.local.get("history"); history.unshift({ ...request.data, savedAt: new Date().toISOString() }); await chrome.storage.local.set({ history: history.slice(0, 100) }); respond({ saved: true }); } catch (e) { respond({ error: e.message }); } })(); return true; }
    case "getHistory": { (async () => { try { const { history = [] } = await chrome.storage.local.get("history"); respond(history); } catch (e) { console.warn("[SW] getHistory:", e.message); respond([]); } })(); return true; }
    case "clearHistory": { chrome.storage.local.set({ history: [] }).then(() => respond({ cleared: true })).catch(e => respond({ error: e.message })); return true; }
    default: respond({ error: "Unknown: " + action }); return true;
  }
});

async function discoverAITabs() {
  const allTabs = await chrome.tabs.query({});
  const aiTabs = [];
  let unreachable = 0;
  for (const tab of allTabs) {
    const url = tab.url || ""; if (!url.startsWith("http")) continue;
    for (const p of AI_URL_PATTERNS) {
      if (url.includes(p)) { let name = p.split(".")[0]; try { await ensureCS(tab.id); const ping = await sendTab(tab.id, { action: "ping" }); if (ping && ping.platformName) name = ping.platformName; } catch (e) { unreachable++; } aiTabs.push({ id: tab.id, url, title: tab.title || "", platform: name }); break; }
    }
  }
  if (unreachable > 0) console.warn(`[SW] discoverAITabs: ${unreachable} AI tab(s) unreachable`);
  return aiTabs;
}

async function dumpAllDOMs(tabs) {
  const downloads = []; let failed = 0;
  for (const tab of tabs) {
    try {
      await ensureCS(tab.id); await sleep(400);
      let dump = null;
      for (let a = 0; a < 3 && !dump; a++) { try { dump = await sendTab(tab.id, { action: "dumpDOM" }); } catch (e) { if (a < 2) { await sleep(1000); await ensureCS(tab.id); await sleep(400); } } }
      if (!dump) { failed++; continue; }
      const platform = (dump.meta && dump.meta.platform) || tab.platform || "unknown";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = "dom-dump-" + platform + "-" + stamp + ".json";
      // Data URL, NOT a Blob object URL — Blob URLs are unreliable inside a
      // service worker (no DOM / registration scoping issues).
      try {
        const json = JSON.stringify(dump, null, 2);
        const durl = "data:application/json;charset=utf-8," + encodeURIComponent(json);
        await chrome.downloads.download({ url: durl, filename, saveAs: false });
      } catch (e) { console.warn("[SW] dom-dump download failed:", e.message); failed++; continue; }
      downloads.push({ tabId: tab.id, platform, hostname: (dump.meta && dump.meta.host) || "", filename, messageSelectorCount: Object.keys(dump.messages || {}).length, customElementCount: (dump.customElements || []).length, url: tab.url });
    } catch (e) { console.warn("[SW] dumpAllDOMs tab failed:", e.message); failed++; }
  }
  return { downloaded: downloads.length > 0, dumped: downloads.length, failed, downloads };
}

async function startBatchExtraction(tabIds) {
  keepAlive();
  batchState = freshState(tabIds);
  await persistBatch();
  await ensureBatchAlarm(true);
  processNextJob(); // kick off immediately; alarm continues if worker dies
}

// Process exactly ONE queued job per call. The alarm re-invokes this until
// the queue is empty, so progress survives worker termination between jobs.
async function processNextJob() {
  if (processing) return;
  const st = await hydrateBatch();
  if (!st || !st.running || st.done || st.cancelled || st.queue.length === 0) {
    if (st && st.queue.length === 0) await finishBatch();
    return;
  }
  processing = true;
  try {
    const job = st.queue.shift();
    if (job.type === "discover") await runDiscoverJob(job);
    else await runChatJob(job);
  } catch (e) {
    addWarn("❌ Job error: " + e.message);
    st.failedCount++;
  } finally {
    processing = false;
    st.currentChat = st.totalChats;
    await persistBatch();
    if (st.cancelled || st.queue.length === 0) await finishBatch();
  }
}

async function finishBatch() {
  const st = batchState;
  if (!st) return;
  const tm = st.conversations.reduce((s, c) => s + (c.messageCount || 0), 0);
  addLog("\n🎉 " + st.conversations.length + " chats, " + tm + " msgs" + (st.failedCount > 0 ? ", " + st.failedCount + " failed" : "") + (st.warnedCount > 0 ? ", " + st.warnedCount + " warnings" : ""));
  st.running = false; st.done = true; st.phase = "done";
  await persistBatch();
  await ensureBatchAlarm(false);
  stopKeepAlive();
}

// Discover a tab's sidebar and expand it into per-chat jobs (or a single
// "current chat" extraction when there is no sidebar).
async function runDiscoverJob(job) {
  const st = batchState; const tabId = job.tabId;
  st.currentTab++;
  let tabInfo; try { tabInfo = await chrome.tabs.get(tabId); } catch (e) { addWarn("⚠️ Tab closed."); st.failedCount++; return; }
  await ensureCS(tabId); await sleep(400);
  let ping; try { ping = await sendTab(tabId, { action: "ping" }); } catch (e) { addWarn("⚠️ Can't reach tab."); st.failedCount++; return; }
  const pName = (ping && ping.platformName) || "Unknown"; st.currentPlatform = pName; st.phase = "collecting";
  addLog("\n🌐 [Tab " + st.currentTab + "/" + st.totalTabs + "] " + pName);
  let chatList; try { chatList = await sendTab(tabId, { action: "collectAllChats" }); } catch (e) {}
  if (!chatList || !chatList.chats || chatList.chats.length === 0) {
    addLog("  ℹ️ No sidebar. Extracting current...");
    st.queue.unshift({ type: "currentChat", tabId, pName });
    return;
  }
  addLog("  📋 " + chatList.chats.length + " conversations");
  // Push chat jobs in reverse so shift() processes them in order
  for (let i = chatList.chats.length - 1; i >= 0; i--) {
    const c = chatList.chats[i];
    st.queue.unshift({ type: "chat", tabId, pName, chat: c });
  }
  st.phase = "extracting";
}

async function runCurrentChatJob(job) {
  const st = batchState;
  st.totalChats++; st.currentChatTitle = "Current";
  try {
    const conv = await sendTab(job.tabId, { action: "extract" });
    if (conv && conv.messages && conv.messages.length > 0) { conv.sidebarTitle = conv.title || "Current"; st.conversations.push(conv); addLog("  ✅ " + conv.messages.length + " msgs"); }
    else { addWarn("  ⚠️ No msgs"); st.failedCount++; }
  } catch (e) { addWarn("  ❌ " + e.message); st.failedCount++; }
}

async function runChatJob(job) {
  const st = batchState; const tabId = job.tabId;
  if (job.type === "currentChat") return runCurrentChatJob(job);
  const chat = job.chat, pName = job.pName;
  st.totalChats++; st.currentChatTitle = chat.title;
  addLog("  📂 " + truncate(chat.title, 40));
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: (url, sel) => { const links = document.querySelectorAll(sel); for (const l of links) { const h = l.getAttribute("href") || l.href || ""; if (h === url || l.href === url || url.endsWith(h)) { l.click(); return; } } window.location.href = url; }, args: [chat.url, getChatLinksSelector(pName)] });
    await sleep(3000); await ensureCS(tabId); await sleep(600);
    let wr; try { wr = await sendTab(tabId, { action: "waitForContent", maxWait: 12000 }); } catch (e) { await sleep(2000); await ensureCS(tabId); await sleep(500); try { wr = await sendTab(tabId, { action: "waitForContent", maxWait: 10000 }); } catch (e2) { addWarn("    ⚠️ Skipped"); st.failedCount++; return; } }
    if (!wr || !wr.ready) { addWarn("    ⚠️ Timeout"); st.failedCount++; return; }
    const conv = await sendTab(tabId, { action: "extract" });
    if (conv && conv.messages && conv.messages.length > 0) { conv.chatId = chat.id; conv.sidebarTitle = chat.title; st.conversations.push(conv); addLog("    ✅ " + conv.messages.length + " msgs"); }
    else { addWarn("    ⚠️ No msgs"); st.failedCount++; }
  } catch (e) { addWarn("    ❌ " + e.message); st.failedCount++; try { await ensureCS(tabId); } catch (_) {} }
  await sleep(800);
}

function truncate(s, n) { s = String(s || ""); return s.length > n ? s.substring(0, n) + "..." : s; }

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

console.log("[AI Session Extractor] Worker v6.0 loaded OK");
