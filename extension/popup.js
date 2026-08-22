// ============================================================
// AI Session Extractor - Popup v4.1
// Added: "Dump DOMs" button — scrapes every open AI tab at once
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const $ = (id) => document.getElementById(id);
  const platformStatus = $("platform-status");
  const platformName = $("platform-name");
  const statusDot = platformStatus.querySelector(".status-dot");
  const tabsSection = $("tabs-section");
  const tabsList = $("tabs-list");
  const btnExtract = $("btn-extract");
  const btnExtractAll = $("btn-extract-all");
  const btnExtractMulti = $("btn-extract-multi");
  const btnDump = $("btn-dump");
  const btnCapture = $("btn-capture");
  const captureLabel = $("capture-label");
  const captureStatus = $("capture-status");
  const wordCount = $("word-count");
  const btnStopCapture = $("btn-stop-capture");
  const batchProgress = $("batch-progress");
  const progressBar = $("progress-bar");
  const batchCurrent = $("batch-current");
  const batchCount = $("batch-count");
  const batchLog = $("batch-log");
  const btnCancelBatch = $("btn-cancel-batch");
  const results = $("results");
  const resultsTitle = $("results-title");
  const msgCount = $("msg-count");
  const preview = $("preview");
  const messageBox = $("message-box");

  let extractedData = null;
  let allChatsData = null;
  let isCapturing = false;
  let captureInterval = null;
  let progressPoller = null;

  // ============================================================
  // INIT
  // ============================================================
  await detectPlatform();
  await discoverTabs();
  await checkRunningBatch();
  setupResumeBanner();

  // ============================================================
  // RESUMABLE BATCH UI (interrupted batch found in storage)
  // ============================================================
  async function setupResumeBanner() {
    try {
      const p = await chrome.runtime.sendMessage({ action: "getBatchProgress" });
      if (!p || !p.resumable || (p.pendingJobs === 0 && !p.running)) return;
      let banner = $("resume-banner");
      if (!banner) return;
      banner.classList.remove("hidden");
      const label = $("resume-label");
      if (label) label.textContent = `Interrupted batch: ${p.successCount} done, ${p.pendingJobs} chat(s) pending${p.failedCount ? `, ${p.failedCount} failed` : ""}.`;
      const btnResume = $("btn-resume");
      const btnDiscard = $("btn-discard");
      if (btnResume) btnResume.addEventListener("click", async () => {
        try {
          const r = await chrome.runtime.sendMessage({ action: "resumeBatch" });
          if (r && r.resumed) { banner.classList.add("hidden"); showBatchUI(); startPolling(); showMsg("info", "Batch resumed."); }
          else showMsg("error", (r && r.error) || "Could not resume.");
        } catch (e) { showMsg("warn", "Resume failed: " + e.message); }
      });
      if (btnDiscard) btnDiscard.addEventListener("click", async () => {
        try { await chrome.runtime.sendMessage({ action: "discardBatch" }); banner.classList.add("hidden"); showMsg("info", "Batch discarded."); }
        catch (e) { showMsg("warn", "Discard failed: " + e.message); }
      });
    } catch (e) { console.warn("[Popup] resume check failed:", e.message); }
  }

  // ============================================================
  // PLATFORM DETECTION
  // ============================================================
  async function detectPlatform() {
    try {
      let tab;
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs && activeTabs.length > 0) tab = activeTabs[0];
      else { setStatus("error", "No active tab"); return; }

      const url = tab.url || "";
      const platforms = [
        ["gemini.google.com", "Gemini"], ["chatgpt.com", "ChatGPT"], ["chat.openai.com", "ChatGPT"],
        ["claude.ai", "Claude"], ["chat.deepseek.com", "DeepSeek"], ["copilot.microsoft.com", "Copilot"],
        ["grok.com", "Grok"], ["x.com/i/grok", "Grok"], ["kimi.moonshot.cn", "Kimi"],
        ["meta.ai", "Meta AI"], ["hailuoai.com", "MiniMax"], ["minimax.io", "MiniMax"],
        ["manus.im", "Manus"], ["manus.app", "Manus"], ["z.ai", "Zai"],
        ["perplexity.ai", "Perplexity"], ["poe.com", "Poe"], ["chat.mistral.ai", "Mistral"],
        ["chatglm.cn", "ChatGLM"], ["kimi.moonshot.cn", "Kimi"],
        ["chat.qwen.ai", "Qwen"], ["qwen.ai", "Qwen"], ["tongyi.aliyun.com", "Qwen"],
        ["pi.ai", "Pi"], ["jules.google.com", "Jules"], ["jules.ai", "Jules"],
        ["huggingface.co/chat", "HuggingChat"], ["character.ai", "Character.AI"],
        ["you.com", "You.com"], ["reka.ai", "Reka"], ["chat.minimax.io", "MiniMax"],
        ["agent.minimax.io", "MiniMax"], ["minimax.chat", "MiniMax"],
      ];
      for (const [pattern, name] of platforms) {
        if (url.includes(pattern)) { setStatus("active", `${name} detected ✓`); return; }
      }
      setStatus("error", "Navigate to an AI chat app");
    } catch (e) { setStatus("error", "Error"); }
  }

  function setStatus(state, text) {
    statusDot.className = "status-dot " + state;
    platformName.textContent = text;
  }

  // ============================================================
  // DISCOVER OPEN AI TABS
  // ============================================================
  async function discoverTabs() {
    try {
      const tabs = await chrome.runtime.sendMessage({ action: "discoverTabs" });
      if (tabs && tabs.length > 0) {
        tabsSection.classList.remove("hidden");
        tabsList.innerHTML = tabs.map(t =>
          `<div class="tab-item"><span class="tab-dot"></span>${esc(t.platform)} <span class="tab-url">${esc(shortenUrl(t.url))}</span></div>`
        ).join("");
      }
    } catch (e) { console.warn("[Popup] tab discovery failed:", e.message); showWarn(`Tab discovery unavailable (${e.message}).`); }
  }

  // ============================================================
  // CHECK IF BATCH ALREADY RUNNING (popup reopened)
  // ============================================================
  async function checkRunningBatch() {
    try {
      const p = await chrome.runtime.sendMessage({ action: "getBatchProgress" });
      if (p && p.running) { showBatchUI(); startPolling(); }
      else if (p && p.done && p.successCount > 0) { showBatchUI(); renderProgress(p); await loadResults(); }
    } catch (e) { console.warn("[Popup] batch check failed:", e.message); }
  }

  // ============================================================
  // SINGLE CHAT EXTRACTION
  // ============================================================
  btnExtract.addEventListener("click", async () => {
    btnExtract.disabled = true;
    btnExtract.innerHTML = '<span class="btn-icon">⏳</span> Extracting...';
    hideMsg();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await inject(tab.id);
      // Retry once if content script not yet ready
      let resp = null;
      try { resp = await chrome.tabs.sendMessage(tab.id, { action: "extract" }); }
      catch (e1) { await sleep(800); resp = await chrome.tabs.sendMessage(tab.id, { action: "extract" }); }

      if (resp && resp.messages && resp.messages.length > 0) {
        extractedData = resp; allChatsData = null;
        showSingleResults(resp);
        showMsg("success", `Extracted ${resp.messages.length} messages!`);
      } else { showMsg("error", "No conversation found on this page."); }
    } catch (e) { showMsg("error", "Failed: " + e.message); }
    finally { btnExtract.disabled = false; btnExtract.innerHTML = '<span class="btn-icon">📋</span> Extract This Chat'; }
  });

  // ============================================================
  // ALL CHATS (THIS TAB)
  // ============================================================
  btnExtractAll.addEventListener("click", async () => {
    hideMsg(); results.classList.add("hidden");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const resp = await chrome.runtime.sendMessage({ action: "startBatch", tabId: tab.id });
      if (resp && resp.started) { showBatchUI(); startPolling(); showMsg("info", "Running in background. You can close this popup!"); }
      else if (resp && resp.error) showMsg("error", resp.error);
    } catch (e) { showMsg("error", e.message); }
  });

  // ============================================================
  // ALL OPEN TABS (MULTI-PLATFORM)
  // ============================================================
  btnExtractMulti.addEventListener("click", async () => {
    hideMsg(); results.classList.add("hidden");
    try {
      const resp = await chrome.runtime.sendMessage({ action: "startMultiBatch" });
      if (resp && resp.started) { showBatchUI(); startPolling(); showMsg("info", `Extracting from ${resp.tabCount} AI tabs in background. Close popup freely!`); }
      else if (resp && resp.error) showMsg("error", resp.error);
    } catch (e) { showMsg("error", e.message); }
  });

  // ============================================================
  // DUMP DOMs OF ALL OPEN AI TABS
  // ============================================================
  btnDump.addEventListener("click", async () => {
    hideMsg(); results.classList.add("hidden");
    btnDump.disabled = true;
    btnDump.innerHTML = '<span class="btn-icon">⏳</span> Dumping...';
    try {
      const resp = await chrome.runtime.sendMessage({ action: "dumpAllDOMs" });
      if (resp && resp.error) showMsg("error", resp.error);
      else if (resp && resp.downloaded && resp.downloads && resp.downloads.length > 0) {
        const warnBits = [];
        if (resp.failed) warnBits.push(`${resp.failed} tab(s) failed`);
        showMsg(warnBits.length ? "warn" : "success", `Dumped ${resp.downloads.length} AI tabs to Downloads${warnBits.length ? ` — ⚠️ ${warnBits.join(", ")}` : ""}.`);
        results.classList.remove("hidden");
        resultsTitle.textContent = "DOM Dumps";
        msgCount.textContent = `${resp.downloads.length} files`;
        preview.innerHTML = resp.downloads.map(d =>
          `<div class="conv-block">
            <div class="conv-title">🔍 [${esc(d.platform || "unknown")}] ${esc(d.hostname || "")}</div>
            <div style="font-size:10px;color:#a5b4fc;padding:2px 0">Filename: ${esc(d.filename)}</div>
            <div style="font-size:10px;color:#71717a;padding:2px 0">Message selectors found: ${d.messageSelectorCount || 0} · Custom elements: ${d.customElementCount || 0}</div>
          </div>`
        ).join("");
      } else if (resp && resp.error) {
        showMsg("error", resp.error);
      } else {
        showMsg("error", "No AI tabs found with active conversations.");
      }
    } catch (e) { showMsg("error", "Failed: " + e.message); }
    finally { btnDump.disabled = false; btnDump.innerHTML = '<span class="btn-icon">🔍</span> Dump DOMs of All Tabs'; }
  });

  btnCancelBatch.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ action: "cancelBatch" });
    showMsg("info", "Cancelling after current chat...");
  });

  // ============================================================
  // PROGRESS POLLING
  // ============================================================
  function showBatchUI() {
    batchProgress.classList.remove("hidden");
    btnExtractAll.disabled = true;
    btnExtractMulti.disabled = true;
  }

  function startPolling() {
    if (progressPoller) clearInterval(progressPoller);
    progressPoller = setInterval(poll, 1000);
    poll();
  }

  function stopPolling() { if (progressPoller) { clearInterval(progressPoller); progressPoller = null; } }

  async function poll() {
    try {
      const p = await chrome.runtime.sendMessage({ action: "getBatchProgress" });
      if (!p) return;
      renderProgress(p);
      if (!p.running && p.done) {
        stopPolling();
        btnExtractAll.disabled = false;
        btnExtractMulti.disabled = false;
        if (p.error) showWarn(`Batch ended with error: ${p.error}`);
        else if (p.failedCount) showWarn(`${p.failedCount} chat(s) failed during batch.`);
        await loadResults();
      }
    } catch (e) { console.warn("[Popup] progress poll failed:", e.message); }
  }

  function renderProgress(p) {
    const total = p.totalChats || 1;
    const current = p.currentChat || 0;
    const pct = Math.round((current / total) * 100);
    progressBar.style.width = pct + "%";
    batchCount.textContent = `${p.successCount} extracted${p.failedCount ? ` · ${p.failedCount} failed` : ""}${p.warnedCount ? ` · ${p.warnedCount} warnings` : ""} · ${current}/${total} processed`;

    let status = "";
    if (p.running) {
      if (p.phase === "collecting") status = `🔍 Scanning ${p.currentPlatform} sidebar...`;
      else {
        const title = (p.currentChatTitle || "").length > 35 ? p.currentChatTitle.substring(0, 35) + "..." : p.currentChatTitle;
        status = `[${p.currentPlatform}] ${title}`;
        if (p.totalTabs > 1) status = `Tab ${p.currentTab}/${p.totalTabs} · ` + status;
      }
    } else if (p.done) {
      status = `✅ Done! ${p.successCount} chats extracted`;
      const bits = [];
      if (p.failedCount) bits.push(`${p.failedCount} failed`);
      if (p.warnedCount) bits.push(`${p.warnedCount} warnings`);
      if (bits.length) status += ` (⚠️ ${bits.join(", ")})`;
    }
    batchCurrent.textContent = status;

    if (p.log && p.log.length > 0) {
      batchLog.innerHTML = p.log.map(l => `<div class="log-line">${esc(l.msg)}</div>`).join("");
      batchLog.scrollTop = batchLog.scrollHeight;
    }
  }

  async function loadResults() {
    try {
      const data = await chrome.runtime.sendMessage({ action: "getBatchResults" });
      if (data && data.conversations && data.conversations.length > 0) {
        allChatsData = data; extractedData = null;
        showBatchResults(data);
        showMsg("success", `${data.conversationCount} chats · ${data.totalMessages} messages extracted!`);
        if (data.failedCount) showWarn(`${data.failedCount} chat(s) failed and were skipped.`);
      }
    } catch (e) { console.warn("[Popup] load results failed:", e.message); }
  }

  // Non-blocking warning banner (counted failures / recoverable errors)
  function showWarn(text) { showMsg("warn", "⚠️ " + text); }

  // ============================================================
  // DISPLAY RESULTS
  // ============================================================
  function showSingleResults(data) {
    results.classList.remove("hidden");
    resultsTitle.textContent = `${data.platformName || data.platform} — Session`;
    msgCount.textContent = `${data.messageCount} messages`;
    let html = "";
    for (const msg of data.messages) {
      const rc = msg.role === "user" ? "msg-user" : "msg-model";
      const rl = msg.role === "user" ? "👤 You" : "🤖 AI";
      html += `<div class="msg ${rc}"><div class="msg-role">${rl} <span style="opacity:.5;font-size:10px">${msg.content.length} chars</span></div><div class="msg-content">${esc(msg.content)}</div></div>`;
    }
    preview.innerHTML = html;
  }

  function showBatchResults(data) {
    results.classList.remove("hidden");
    resultsTitle.textContent = `All Chats (${data.conversationCount})`;
    msgCount.textContent = `${data.totalMessages} messages`;
    let html = `<div class="batch-summary"><strong>📚 ${data.conversationCount} conversations</strong> · ${data.totalMessages} messages${data.failedCount > 0 ? ` · <span style="color:#f87171">${data.failedCount} failed</span>` : ""}</div><hr style="border-color:#333;margin:8px 0">`;
    for (let c = 0; c < data.conversations.length; c++) {
      const conv = data.conversations[c];
      const title = conv.sidebarTitle || conv.title || "Untitled";
      const plat = conv.platformName || conv.platform || "";
      html += `<div class="conv-block"><div class="conv-title">💬 ${c + 1}. [${plat}] ${esc(title)} <span style="opacity:.5">(${conv.messageCount} msgs)</span></div>`;
      for (const msg of conv.messages.slice(0, 6)) {
        const rc = msg.role === "user" ? "msg-user" : "msg-model";
        const rl = msg.role === "user" ? "👤" : "🤖";
        const prev = msg.content.length > 200 ? msg.content.substring(0, 200) + "..." : msg.content;
        html += `<div class="msg ${rc} compact"><div class="msg-role">${rl} <span style="opacity:.5;font-size:10px">${msg.content.length} chars</span></div><div class="msg-content">${esc(prev)}</div></div>`;
      }
      if (conv.messages.length > 6) html += `<div style="font-size:10px;color:#71717a;padding:4px">... +${conv.messages.length - 6} more messages</div>`;
      html += `</div>`;
    }
    preview.innerHTML = html;
  }

  // ============================================================
  // LIVE CAPTURE
  // ============================================================
  btnCapture.addEventListener("click", async () => {
    if (isCapturing) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await inject(tab.id);
      const r = await chrome.tabs.sendMessage(tab.id, { action: "startCapture" });
      if (r?.status === "capturing") {
        isCapturing = true; captureStatus.classList.remove("hidden"); btnCapture.classList.add("hidden");
        captureInterval = setInterval(async () => {
          try { const s = await chrome.tabs.sendMessage(tab.id, { action: "getCaptureStatus" }); if (s) wordCount.textContent = s.wordCount || 0; } catch (e) {}
        }, 500);
      }
    } catch (e) { showMsg("error", "Failed to start capture."); }
  });

  btnStopCapture.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const r = await chrome.tabs.sendMessage(tab.id, { action: "stopCapture" });
      if (r?.status === "stopped") {
        isCapturing = false; captureStatus.classList.add("hidden"); btnCapture.classList.remove("hidden");
        clearInterval(captureInterval);
        if (r.words?.length > 0) {
          extractedData = { platform: "generic", platformName: "Live", url: tab.url, title: "Live Capture", extractedAt: new Date().toISOString(), messageCount: 1, messages: [{ role: "captured", content: r.words.map(w => w.word).join(" "), index: 0 }] };
          showSingleResults(extractedData);
          showMsg("success", `Captured ${r.wordCount} words!`);
        } else showMsg("info", "No words captured.");
      }
    } catch (e) { showMsg("error", "Failed."); }
  });

  // ============================================================
  // EXPORTS
  // ============================================================
  $("export-txt").addEventListener("click", () => exportAs("txt"));
  $("export-md").addEventListener("click", () => exportAs("md"));
  $("export-json").addEventListener("click", () => exportAs("json"));
  $("export-csv").addEventListener("click", () => exportAs("csv"));
  $("copy-clipboard").addEventListener("click", copyClip);

  function exportAs(fmt) {
    const data = allChatsData || extractedData;
    if (!data) { showMsg("error", "Nothing to export."); return; }
    const isBatch = !!allChatsData;
    const stamp = new Date().toISOString().slice(0, 10);
    let content = "", fn = "", mime = "text/plain";

    if (fmt === "json") { content = JSON.stringify(data, null, 2); mime = "application/json"; }
    else if (fmt === "txt") { content = isBatch ? batchTxt(data) : singleTxt(data); }
    else if (fmt === "md") { content = isBatch ? batchMd(data) : singleMd(data); mime = "text/markdown"; }
    else if (fmt === "csv") { content = isBatch ? batchCsv(data) : singleCsv(data); mime = "text/csv"; }

    fn = isBatch ? `ai-all-chats-${stamp}.${fmt}` : `ai-session-${stamp}.${fmt}`;
    const blob = new Blob([content], { type: mime });
    chrome.downloads.download({ url: URL.createObjectURL(blob), filename: fn, saveAs: true });
    showMsg("success", `Exported ${fmt.toUpperCase()}!`);
  }

  function singleTxt(d) {
    let t = `AI Session Extractor\nPlatform: ${d.platformName || d.platform}\nTitle: ${d.title}\nURL: ${d.url}\nMessages: ${d.messageCount}\n${"=".repeat(60)}\n\n`;
    d.messages.forEach((m, i) => { t += `[${m.role === "user" ? "YOU" : "AI"}] #${i + 1}\n${"-".repeat(40)}\n${m.content}\n\n`; });
    return t;
  }
  function singleMd(d) {
    let md = `# ${d.title}\n\n> ${d.platformName || d.platform} | ${new Date(d.extractedAt).toLocaleString()}\n\n---\n\n`;
    d.messages.forEach(m => { md += `## ${m.role === "user" ? "👤 User" : "🤖 AI"}\n\n${m.content}\n\n---\n\n`; });
    return md;
  }
  // Sanitize a CSV cell to prevent formula injection (=,+,-,@ prefixes, tabs, CR)
  function csvSafe(value) {
    let v = String(value ?? "").replace(/[\r\n\t]+/g, " ");
    let first = v.charAt(0);
    if (first === "=" || first === "+" || first === "-" || first === "@" || first === "\t" || first === "\r") v = "'" + v;
    return v;
  }
  function singleCsv(d) {
    let c = "Index,Role,Content\n";
    d.messages.forEach((m, i) => { c += `${i + 1},${csvSafe(m.role)},"${csvSafe(m.content).replace(/"/g, '""')}"\n`; });
    return c;
  }
  function batchTxt(d) {
    let t = `AI Session Extractor - ALL CHATS\nExported: ${d.exportedAt}\nConversations: ${d.conversationCount}\nTotal Messages: ${d.totalMessages}\n${"=".repeat(70)}`;
    d.conversations.forEach((conv, ci) => {
      t += `\n${"█".repeat(70)}\n[${conv.platformName || conv.platform}] ${conv.sidebarTitle || conv.title}\nURL: ${conv.url}\n${"█".repeat(70)}\n\n`;
      conv.messages.forEach((m, i) => { t += `[${m.role === "user" ? "YOU" : "AI"}] #${i + 1}\n${m.content}\n\n`; });
    });
    return t;
  }
  function batchMd(d) {
    let md = `# All AI Conversations\n\n> ${d.conversationCount} chats · ${d.totalMessages} messages · ${new Date(d.exportedAt).toLocaleString()}\n\n---\n\n`;
    d.conversations.forEach((conv, ci) => {
      md += `# ${ci + 1}. [${conv.platformName || conv.platform}] ${conv.sidebarTitle || conv.title}\n\n`;
      conv.messages.forEach(m => { md += `### ${m.role === "user" ? "👤" : "🤖"}\n\n${m.content}\n\n---\n\n`; });
    });
    return md;
  }
  function batchCsv(d) {
    let c = "ConvIndex,Platform,Title,MsgIndex,Role,Content\n";
    d.conversations.forEach((conv, ci) => {
      const t = `"${csvSafe(conv.sidebarTitle || conv.title || "").replace(/"/g, '""')}"`;
      conv.messages.forEach((m, i) => { c += `${ci + 1},${csvSafe(conv.platform)},${t},${i + 1},${csvSafe(m.role)},"${csvSafe(m.content).replace(/"/g, '""')}"\n`; });
    });
    return c;
  }

  async function copyClip() {
    const data = allChatsData || extractedData;
    if (!data) { showMsg("error", "Nothing to copy."); return; }
    const text = allChatsData ? batchTxt(data) : singleTxt(data);
    try { await navigator.clipboard.writeText(text); showMsg("success", "Copied!"); }
    catch (e) { showMsg("error", "Copy failed."); }
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  async function inject(tabId) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await sleep(500);
    } catch (e) { console.error('[Popup] Inject failed:', e); }
  }
  function showMsg(type, text) { messageBox.className = `message-box ${type}`; messageBox.textContent = text; messageBox.classList.remove("hidden"); setTimeout(() => messageBox.classList.add("hidden"), 8000); }
  function hideMsg() { messageBox.classList.add("hidden"); }
  function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function shortenUrl(u) { try { return new URL(u).hostname + new URL(u).pathname.substring(0, 20); } catch (e) { return u.substring(0, 30); } }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
});
