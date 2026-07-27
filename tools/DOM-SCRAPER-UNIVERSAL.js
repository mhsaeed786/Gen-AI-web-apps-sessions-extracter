// ============================================================
// UNIVERSAL AI CHAT DOM SCRAPER
// Paste this into DevTools Console on ANY AI chat platform
// It auto-detects the platform and dumps DOM structure
// ============================================================
// USAGE:
// 1. Open DevTools (F12) → Console tab
// 2. Type: allow pasting  (if Chrome blocks paste)
// 3. Paste this entire script and press Enter
// 4. A JSON file will download with the DOM analysis
// ============================================================

(async () => {
  const url = location.href;
  const host = location.hostname;

  // Platform detection
  let platform = "unknown";
  if (host.includes("gemini.google")) platform = "gemini";
  else if (host.includes("chatgpt") || host.includes("chat.openai")) platform = "chatgpt";
  else if (host.includes("claude.ai")) platform = "claude";
  else if (host.includes("deepseek")) platform = "deepseek";
  else if (host.includes("copilot.microsoft")) platform = "copilot";
  else if (host.includes("grok") || (host.includes("x.com") && url.includes("grok"))) platform = "grok";
  else if (host.includes("kimi") || host.includes("moonshot")) platform = "kimi";
  else if (host.includes("meta.ai")) platform = "metaai";
  else if (host.includes("hailuo") || host.includes("minimax")) platform = "minimax";
  else if (host.includes("manus")) platform = "manus";
  else if (host.includes("z.ai")) platform = "zai";
  else if (host.includes("perplexity")) platform = "perplexity";
  else if (host.includes("poe")) platform = "poe";
  else if (host.includes("pi.ai") || host.includes("inflection")) platform = "pi";
  else if (host.includes("cohere") || host.includes("coral")) platform = "cohere";
  else if (host.includes("mistral") || host.includes("le.chat")) platform = "mistral";
  else if (host.includes("you.com")) platform = "you";
  else if (host.includes("phind")) platform = "phind";
  else if (host.includes("huggingface") && url.includes("chat")) platform = "huggingchat";
  else if (host.includes("character.ai")) platform = "characterai";
  else if (host.includes("replika")) platform = "replika";
  else if (host.includes("cody") || host.includes("sourcegraph")) platform = "cody";
  else if (host.includes("codeium") || host.includes("windsurf")) platform = "codeium";
  else if (host.includes("tabnine")) platform = "tabnine";
  else if (host.includes("writesonic") || host.includes("chatsonic")) platform = "chatsonic";
  else if (host.includes("jasper")) platform = "jasper";
  else if (host.includes("copy.ai")) platform = "copyai";
  else if (host.includes("rytr")) platform = "rytr";
  else if (host.includes("tome")) platform = "tome";
  else if (host.includes("gamma")) platform = "gamma";

  console.log(`%c[DOM Scraper] Platform: ${platform} (${host})`, "color:#4ade80;font-weight:bold");

  const dump = {
    meta: {
      platform,
      url,
      host,
      title: document.title,
      scrapedAt: new Date().toISOString(),
      bodyClasses: document.body.className,
    },

    // ---- MESSAGE SELECTORS ----
    messages: {},

    // ---- SIDEBAR / HISTORY ----
    sidebar: {},

    // ---- SCROLL CONTAINERS ----
    scrollers: [],

    // ---- ALL CUSTOM ELEMENTS ----
    customElements: [],

    // ---- DATA ATTRIBUTES ----
    dataAttributes: {},

    // ---- CLASS PATTERNS ----
    classPatterns: {},
  };

  // ============================================================
  // 1. Find message-like elements
  // ============================================================
  const msgSelectors = [
    // Generic
    '[class*="message"]', '[class*="Message"]',
    '[class*="chat"]', '[class*="Chat"]',
    '[class*="conversation"]', '[class*="Conversation"]',
    '[class*="turn"]', '[class*="Turn"]',
    '[class*="response"]', '[class*="Response"]',
    '[class*="query"]', '[class*="Query"]',
    '[class*="prompt"]', '[class*="Prompt"]',
    '[class*="answer"]', '[class*="Answer"]',
    '[class*="user"]', '[class*="User"]',
    '[class*="assistant"]', '[class*="Assistant"]',
    '[class*="model"]', '[class*="Model"]',
    '[class*="human"]', '[class*="Human"]',
    '[class*="bot"]', '[class*="Bot"]',
    '[class*="markdown"]', '[class*="Markdown"]',
    '[class*="content"]', '[class*="Content"]',
    '[class*="text"]', '[class*="Text"]',
    '[class*="bubble"]', '[class*="Bubble"]',
    // Data attributes
    '[data-message-author-role]',
    '[data-role]',
    '[data-testid*="message"]',
    '[data-testid*="conversation"]',
    '[data-testid*="chat"]',
    '[data-testid*="user"]',
    '[data-testid*="assistant"]',
    // Custom elements
    'user-query', 'model-response', 'model-response-primary',
    'cib-message', 'cib-message-group', 'cib-conversation',
    // ARIA
    '[role="log"]', '[role="article"]',
    '[aria-label*="message"]', '[aria-label*="Message"]',
  ];

  for (const sel of msgSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0 && els.length < 500) {
        const samples = Array.from(els).slice(0, 5).map(el => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: (el.className || "").toString().substring(0, 200),
          dataAttrs: Object.keys(el.dataset).slice(0, 10),
          text: (el.textContent || "").substring(0, 100).trim(),
          childCount: el.children.length,
          rect: el.getBoundingClientRect ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null,
        }));
        dump.messages[sel] = { count: els.length, samples };
      }
    } catch (e) {}
  }

  // ============================================================
  // 2. Find sidebar / history links
  // ============================================================
  const sidebarSelectors = [
    'nav', '[class*="sidebar"]', '[class*="Sidebar"]',
    '[class*="history"]', '[class*="History"]',
    '[class*="conversation-list"]', '[class*="chat-list"]',
    '[data-testid*="conversation"]', '[data-testid*="history"]',
    '[data-testid*="sidebar"]', '[data-testid*="nav"]',
  ];

  for (const sel of sidebarSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0 && els.length < 50) {
        const samples = Array.from(els).slice(0, 3).map(el => ({
          tag: el.tagName.toLowerCase(),
          className: (el.className || "").toString().substring(0, 200),
          childCount: el.children.length,
          links: Array.from(el.querySelectorAll("a")).slice(0, 10).map(a => ({
            href: (a.getAttribute("href") || "").substring(0, 100),
            text: (a.textContent || "").substring(0, 60).trim(),
          })),
        }));
        dump.sidebar[sel] = { count: els.length, samples };
      }
    } catch (e) {}
  }

  // ============================================================
  // 3. Find scroll containers
  // ============================================================
  const allEls = document.querySelectorAll("*");
  for (const el of allEls) {
    if (el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 200) {
      dump.scrollers.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: (el.className || "").toString().substring(0, 150),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        childCount: el.children.length,
        dataTestId: el.getAttribute("data-testid") || null,
      });
    }
    if (dump.scrollers.length >= 15) break;
  }

  // ============================================================
  // 4. Custom elements (web components)
  // ============================================================
  const customSet = new Set();
  for (const el of allEls) {
    if (el.tagName.includes("-")) customSet.add(el.tagName.toLowerCase());
  }
  dump.customElements = Array.from(customSet).sort();

  // ============================================================
  // 5. Data attributes used on the page
  // ============================================================
  const dataAttrSet = new Set();
  for (const el of Array.from(allEls).slice(0, 3000)) {
    for (const attr of el.attributes) {
      if (attr.name.startsWith("data-")) dataAttrSet.add(attr.name);
    }
  }
  dump.dataAttributes = Array.from(dataAttrSet).sort();

  // ============================================================
  // 6. Most common class patterns (for message identification)
  // ============================================================
  const classCount = {};
  for (const el of Array.from(allEls).slice(0, 5000)) {
    const cls = (el.className || "").toString();
    if (cls && /msg|message|chat|user|assistant|model|human|bot|query|response|answer|content|text|turn|bubble/i.test(cls)) {
      const key = cls.substring(0, 100);
      classCount[key] = (classCount[key] || 0) + 1;
    }
  }
  dump.classPatterns = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([cls, count]) => ({ class: cls, count }));

  // ============================================================
  // 7. Sample HTML of first few "message-like" elements
  // ============================================================
  dump.sampleHTML = [];
  const sampleSelectors = [
    '[data-message-author-role]',
    '[class*="message"]',
    '[class*="Message"]',
    '[class*="turn"]',
    '[class*="query"]',
    '[class*="response"]',
    '[class*="markdown"]',
  ];
  for (const sel of sampleSelectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      dump.sampleHTML.push({
        selector: sel,
        count: els.length,
        outerHTML: els[0].outerHTML.substring(0, 2000),
      });
      if (dump.sampleHTML.length >= 5) break;
    }
  }

  // ============================================================
  // DOWNLOAD
  // ============================================================
  const filename = `dom-dump-${platform}-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();

  console.log(`%c[DOM Scraper] Downloaded: ${filename}`, "color:#4ade80;font-weight:bold");
  console.log(`%c[DOM Scraper] Found: ${Object.keys(dump.messages).length} message selectors, ${dump.customElements.length} custom elements, ${dump.scrollers.length} scrollers`, "color:#a5b4fc");
  console.log("%c[DOM Scraper] Share this file to get accurate selectors!", "color:#facc15");

  return dump;
})();
