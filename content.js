// ============================================================
// AI Session Extractor - Multi-Platform Content Script v4.1
// FIX: message channel closed errors during SPA navigation
// ============================================================

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__AI_EXTRACTOR_LOADED__) {
    console.log("[AI Session Extractor] Already loaded, skipping re-injection");
    return;
  }
  window.__AI_EXTRACTOR_LOADED__ = true;

  // ============================================================
  // PLATFORM DETECTION
  // ============================================================

  function detectPlatform() {
    const url = window.location.href;
    if (url.includes("gemini.google.com")) return "gemini";
    if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "chatgpt";
    if (url.includes("claude.ai")) return "claude";
    if (url.includes("chat.deepseek.com")) return "deepseek";
    if (url.includes("copilot.microsoft.com")) return "copilot";
    if (url.includes("grok.com") || url.includes("x.com/i/grok")) return "grok";
    if (url.includes("kimi.moonshot.cn")) return "kimi";
    if (url.includes("meta.ai")) return "metaai";
    if (url.includes("hailuoai.com") || url.includes("minimax.io")) return "minimax";
    if (url.includes("manus.im") || url.includes("manus.app")) return "manus";
    if (url.includes("z.ai")) return "zai";
    return "generic";
  }

  const PLATFORM = detectPlatform();

  // ============================================================
  // PLATFORM SELECTOR CONFIGS
  // ============================================================

  const PLATFORMS = {
    gemini: {
      name: "Gemini",
      scroller: [
        'infinite-scroller[data-test-id="chat-history-container"]',
        '[class*="chat-history-scroll"]',
        'infinite-scroller',
      ],
      userMsg: [
        "user-query",
        ".query-text",
        '[class*="query-text"]',
        '[class*="user-query"]',
      ],
      modelMsg: [
        "model-response",
        ".model-response-text",
        '[class*="model-response-text"]',
        "model-response-primary",
        '[class*="model-response-primary"]',
        '[class*="markdown"]',
      ],
      sidebar: [
        '[data-test-id="all-conversations"]',
        'conversations-list',
        '[data-test-id="chats-expandable-section"]',
        '[class*="conversation-list"]',
      ],
      chatLinks: '[data-test-id="conversation"] a, a[href*="/app/"]',
      chatUrlPattern: /\/app\/([a-f0-9]+)/i,
      titleSelectors: [
        '[class*="conversation-title"]',
        '[class*="chat-title"]',
        '[class*="title-text"]',
      ],
    },

    chatgpt: {
      name: "ChatGPT",
      scroller: [
        '[data-testid="conversation-turn-list"]',
        '#conversation-scroll-container',
        '[class*="conversation"]',
        'main [class*="scroll"]',
      ],
      userMsg: [
        '[data-message-author-role="user"]',
        '[class*="user"] [class*="message"]',
      ],
      modelMsg: [
        '[data-message-author-role="assistant"]',
        '[class*="assistant"] [class*="message"]',
        '[class*="markdown"]',
      ],
      sidebar: [
        'nav',
        '[class*="sidebar"]',
        '[data-testid="conversation-turn"]',
      ],
      chatLinks: 'nav a[href*="/c/"], a[href*="/c/"]',
      chatUrlPattern: /\/c\/([a-f0-9-]+)/i,
      titleSelectors: [
        '[data-testid="conversation-name"]',
        'h1',
        '[class*="title"]',
      ],
    },

    claude: {
      name: "Claude",
      scroller: [
        '[class*="conversation"]',
        '[class*="chat"] [class*="scroll"]',
        'main',
      ],
      userMsg: [
        '[data-testid="user-message"]',
        '[class*="user-message"]',
        '[class*="human"]',
        'font-claude-message[class*="user"]',
      ],
      modelMsg: [
        '[data-testid="assistant-message"]',
        '[class*="assistant-message"]',
        '[class*="claude"] [class*="message"]',
        'font-claude-message[class*="assistant"]',
        '[class*="markdown"]',
      ],
      sidebar: [
        '[class*="sidebar"]',
        'nav',
        '[class*="conversation-list"]',
      ],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: [
        '[class*="conversation-title"]',
        'h1',
        '[class*="title"]',
      ],
    },

    deepseek: {
      name: "DeepSeek",
      scroller: [
        '[class*="chat-list"]',
        '[class*="message-list"]',
        'main [class*="scroll"]',
        '#chat-container',
      ],
      userMsg: [
        '[class*="user-message"]',
        '[class*="message-user"]',
        '[data-role="user"]',
        '[class*="user"] [class*="content"]',
      ],
      modelMsg: [
        '[class*="assistant-message"]',
        '[class*="message-assistant"]',
        '[data-role="assistant"]',
        '[class*="ds-markdown"]',
        '[class*="markdown"]',
      ],
      sidebar: [
        '[class*="sidebar"]',
        '[class*="chat-history"]',
        'nav',
      ],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    copilot: {
      name: "Copilot",
      scroller: [
        'cib-conversation',
        '[class*="conversation"]',
        '[class*="chat"] [class*="scroll"]',
        'main',
      ],
      userMsg: [
        'cib-message-group[source="user"]',
        '[class*="user"] [class*="message"]',
        '[data-content="user"]',
      ],
      modelMsg: [
        'cib-message-group[source="bot"]',
        'cib-message-group[source="suggested"]',
        '[class*="bot"] [class*="message"]',
        '[class*="markdown"]',
        '[data-content="bot"]',
      ],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/search/"]',
      chatUrlPattern: /\/search\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    grok: {
      name: "Grok",
      scroller: [
        '[class*="conversation"]',
        '[class*="chat"] [class*="messages"]',
        'main [class*="scroll"]',
      ],
      userMsg: [
        '[data-testid="user-message"]',
        '[class*="user-message"]',
        '[class*="human"]',
      ],
      modelMsg: [
        '[data-testid="model-response"]',
        '[class*="model-response"]',
        '[class*="assistant"]',
        '[class*="markdown"]',
      ],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    kimi: {
      name: "Kimi",
      scroller: [
        '[class*="chat-content"]',
        '[class*="message-list"]',
        'main [class*="scroll"]',
      ],
      userMsg: [
        '[class*="user-message"]',
        '[class*="message-user"]',
        '[class*="user"] [class*="content"]',
      ],
      modelMsg: [
        '[class*="assistant-message"]',
        '[class*="message-assistant"]',
        '[class*="kimi"] [class*="content"]',
        '[class*="markdown"]',
      ],
      sidebar: ['[class*="sidebar"]', '[class*="history"]', 'nav'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    metaai: {
      name: "Meta AI",
      scroller: [
        '[class*="conversation"]',
        '[class*="chat"] [class*="scroll"]',
        'main',
      ],
      userMsg: [
        '[class*="user-message"]',
        '[class*="message-user"]',
        '[data-testid*="user"]',
      ],
      modelMsg: [
        '[class*="assistant-message"]',
        '[class*="ai-message"]',
        '[class*="markdown"]',
      ],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    minimax: {
      name: "MiniMax",
      scroller: [
        '[class*="chat"]',
        '[class*="message-list"]',
        'main [class*="scroll"]',
      ],
      userMsg: [
        '[class*="user"]',
        '[class*="human"]',
        '[class*="question"]',
      ],
      modelMsg: [
        '[class*="assistant"]',
        '[class*="bot"]',
        '[class*="answer"]',
        '[class*="markdown"]',
      ],
      sidebar: ['[class*="sidebar"]', 'nav', '[class*="history"]'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    manus: {
      name: "Manus",
      scroller: [
        '[class*="chat"]',
        '[class*="conversation"]',
        'main [class*="scroll"]',
      ],
      userMsg: [
        '[class*="user"]',
        '[class*="human"]',
      ],
      modelMsg: [
        '[class*="assistant"]',
        '[class*="agent"]',
        '[class*="markdown"]',
      ],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/task/"], a[href*="/chat/"]',
      chatUrlPattern: /\/(?:task|chat)\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    zai: {
      name: "Zai",
      scroller: [
        '[class*="chat"]',
        '[class*="conversation"]',
        'main',
      ],
      userMsg: ['[class*="user"]', '[class*="human"]', '[class*="question"]'],
      modelMsg: ['[class*="assistant"]', '[class*="bot"]', '[class*="markdown"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    generic: {
      name: "AI Chat",
      scroller: ['main', '[class*="chat"]', '[class*="conversation"]', '[role="main"]'],
      userMsg: [
        '[class*="user"]', '[class*="human"]', '[class*="question"]',
        '[data-role="user"]', '[data-author="user"]',
      ],
      modelMsg: [
        '[class*="assistant"]', '[class*="bot"]', '[class*="ai"]',
        '[class*="response"]', '[class*="answer"]', '[class*="markdown"]',
        '[data-role="assistant"]', '[data-author="assistant"]',
      ],
      sidebar: ['[class*="sidebar"]', 'nav', '[class*="history"]'],
      chatLinks: 'a[href*="/chat/"], a[href*="/c/"], a[href*="/conversation/"]',
      chatUrlPattern: /\/(?:chat|c|conversation)\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1', 'title'],
    },
  };

  const config = PLATFORMS[PLATFORM] || PLATFORMS.generic;

  // ============================================================
  // EXTRACTION ENGINE
  // ============================================================

  function extractConversation() {
    const messages = [];

    // Find scroller
    let scroller = null;
    for (const sel of config.scroller) {
      scroller = document.querySelector(sel);
      if (scroller) break;
    }

    if (scroller) {
      extractFromContainer(scroller, messages);
    }

    // Fallback: direct queries across entire document
    if (messages.length === 0) {
      extractViaDirectQueries(messages);
    }

    // Fallback: broad scan
    if (messages.length === 0) {
      extractViaBroadScan(messages);
    }

    if (messages.length === 0) return null;

    // Sort by DOM order and deduplicate
    messages.sort((a, b) => (a._domOrder || 0) - (b._domOrder || 0));
    deduplicateMessages(messages);

    messages.forEach((m, i) => { m.index = i; delete m._domOrder; });

    return {
      platform: PLATFORM,
      platformName: config.name,
      url: window.location.href,
      title: extractTitle(),
      extractedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages,
    };
  }

  function extractFromContainer(container, messages) {
    const children = Array.from(container.children);
    for (const child of children) {
      const cls = (child.className || "").toString().toLowerCase();
      if (/zero-state|banner|disclaimer|sidebar|nav|header|footer|input|composer/i.test(cls)) continue;

      const userEl = findFirst(child, config.userMsg);
      if (userEl) {
        const text = extractFullText(userEl);
        if (text.trim().length > 0) {
          messages.push({ role: "user", content: text.trim(), timestamp: null, _domOrder: getDomOrder(userEl) });
        }
      }

      const modelEl = findFirst(child, config.modelMsg);
      if (modelEl) {
        const text = extractFullText(modelEl);
        if (text.trim().length > 0) {
          messages.push({ role: "model", content: text.trim(), timestamp: null, _domOrder: getDomOrder(modelEl) });
        }
      }

      if (!userEl && !modelEl) {
        const text = (child.innerText || "").trim();
        if (text.length > 20) {
          const hasMarkdown = child.querySelector('[class*="markdown"], pre, code');
          if (hasMarkdown) {
            messages.push({ role: "model", content: extractFullText(child).trim(), timestamp: null, _domOrder: getDomOrder(child) });
          }
        }
      }
    }
  }

  function extractViaDirectQueries(messages) {
    const allEls = [];

    for (const sel of config.userMsg) {
      document.querySelectorAll(sel).forEach((el) => allEls.push({ el, role: "user" }));
    }
    for (const sel of config.modelMsg) {
      document.querySelectorAll(sel).forEach((el) => allEls.push({ el, role: "model" }));
    }

    allEls.sort((a, b) => getDomOrder(a.el) - getDomOrder(b.el));

    for (const { el, role } of allEls) {
      const text = extractFullText(el);
      if (text.trim().length > 0) {
        messages.push({ role, content: text.trim(), timestamp: null, _domOrder: getDomOrder(el) });
      }
    }
  }

  function extractViaBroadScan(messages) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const cls = (node.className || "").toString().toLowerCase();
        const tag = node.tagName.toLowerCase();
        const role = node.getAttribute("data-role") || node.getAttribute("data-message-author-role") || "";
        if (/user|human|question|assistant|bot|model|response|answer|markdown/i.test(cls) ||
            /user|assistant/i.test(role) ||
            tag === "user-query" || tag === "model-response") {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      const cls = (node.className || "").toString().toLowerCase();
      const role = node.getAttribute("data-role") || node.getAttribute("data-message-author-role") || "";
      let msgRole = "unknown";
      if (/user|human|question/i.test(cls) || /user/i.test(role)) msgRole = "user";
      else if (/assistant|bot|model|response|answer|markdown/i.test(cls) || /assistant/i.test(role)) msgRole = "model";

      const text = extractFullText(node);
      if (text.trim().length > 10) {
        messages.push({ role: msgRole, content: text.trim(), timestamp: null, _domOrder: getDomOrder(node) });
      }
    }
  }

  function findFirst(parent, selectors) {
    for (const sel of selectors) {
      const el = parent.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function deduplicateMessages(messages) {
    for (let i = messages.length - 1; i >= 1; i--) {
      const curr = messages[i].content;
      const prev = messages[i - 1].content;
      if (curr === prev) { messages.splice(i, 1); continue; }
      if (curr.includes(prev) && curr.length > prev.length * 0.8) { messages.splice(i - 1, 1); }
      else if (prev.includes(curr) && prev.length > curr.length * 0.8) { messages.splice(i, 1); }
    }
  }

  // ============================================================
  // TEXT EXTRACTION
  // ============================================================

  function extractFullText(element) {
    if (!element) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll("button, [class*='button'], [class*='action'], [class*='toolbar'], [class*='copy'], [class*='tts'], [class*='feedback'], [class*='rating'], [class*='share'], svg, [class*='icon']").forEach((el) => el.remove());
    return processNodeToString(clone);
  }

  function processNodeToString(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    if (node.hidden || node.style?.display === "none" || node.style?.visibility === "hidden") return "";

    let result = "", prefix = "", suffix = "";
    const blockTags = ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "blockquote", "section", "article", "pre", "table", "ul", "ol", "br", "hr"];
    if (blockTags.includes(tag)) { prefix = "\n"; suffix = "\n"; }

    if (/^h[1-6]$/.test(tag)) { prefix = "\n" + "#".repeat(parseInt(tag[1])) + " "; suffix = "\n"; }
    if (tag === "li") {
      const parent = node.parentElement;
      if (parent && parent.tagName.toLowerCase() === "ol") {
        prefix = "\n" + (Array.from(parent.children).indexOf(node) + 1) + ". ";
      } else { prefix = "\n- "; }
    }
    if (tag === "pre") {
      const codeEl = node.querySelector("code");
      const lang = detectLang(node);
      return "\n```" + lang + "\n" + (codeEl || node).textContent + "\n```\n";
    }
    if (tag === "code" && !node.closest("pre")) return "`" + node.textContent + "`";
    if (tag === "strong" || tag === "b") { prefix = "**"; suffix = "**"; }
    if (tag === "em" || tag === "i") { prefix = "*"; suffix = "*"; }
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      const text = node.textContent;
      if (href && href !== text) return "[" + text + "](" + href + ")";
    }
    if (tag === "td" || tag === "th") prefix = " | ";
    if (tag === "tr") suffix = " |\n";
    if (tag === "br") return "\n";

    for (const child of node.childNodes) result += processNodeToString(child);
    return prefix + result + suffix;
  }

  function detectLang(preEl) {
    const codeEl = preEl.querySelector("code");
    if (codeEl) {
      const match = (codeEl.className || "").match(/language-(\w+)/);
      if (match) return match[1];
    }
    return "";
  }

  // ============================================================
  // ALL-CHATS: Collect sidebar links
  // ============================================================

  async function collectAllChats() {
    const chats = [];
    const seen = new Set();

    // Expand sidebar if collapsed
    await expandSidebar();

    // Find sidebar scroll container
    let sidebarScroll = null;
    for (const sel of config.sidebar) {
      sidebarScroll = document.querySelector(sel);
      if (sidebarScroll) break;
    }
    if (!sidebarScroll) {
      sidebarScroll = document.querySelector('[class*="drawer"]') ||
                      document.querySelector('[class*="panel"]') ||
                      document.querySelector('[role="navigation"]');
    }

    // Scroll sidebar to load all items
    if (sidebarScroll) {
      let prevCount = 0, stableRounds = 0;
      for (let i = 0; i < 80; i++) {
        collectLinks(sidebarScroll, chats, seen);
        if (chats.length === prevCount) { stableRounds++; if (stableRounds >= 4) break; }
        else stableRounds = 0;
        prevCount = chats.length;
        sidebarScroll.scrollTop = sidebarScroll.scrollHeight;
        await sleep(500);
      }
    }

    // Also collect from full document
    collectLinks(document, chats, seen);

    // If Gemini and still few results, try expanding "Show more"
    if (PLATFORM === "gemini" && chats.length < 5) {
      const expandBtns = document.querySelectorAll('[class*="expand"], [class*="show-more"], [class*="see-all"], button[aria-expanded="false"]');
      for (const btn of expandBtns) {
        const text = (btn.textContent || "").toLowerCase();
        if (/show|expand|more|all|recent/i.test(text) || btn.getAttribute("aria-expanded") === "false") {
          btn.click();
          await sleep(1000);
        }
      }
      collectLinks(document, chats, seen);
      if (sidebarScroll) {
        for (let i = 0; i < 30; i++) {
          collectLinks(sidebarScroll, chats, seen);
          sidebarScroll.scrollTop = sidebarScroll.scrollHeight;
          await sleep(400);
        }
      }
    }

    return { total: chats.length, chats, platform: PLATFORM };
  }

  function collectLinks(root, chats, seen) {
    const links = root.querySelectorAll(config.chatLinks);
    for (const link of links) {
      const href = link.getAttribute("href") || link.href || "";
      const match = href.match(config.chatUrlPattern);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        const title = link.textContent.trim() || link.getAttribute("aria-label") || "Untitled";
        const baseUrl = window.location.origin;
        chats.push({
          id: match[1],
          url: href.startsWith("http") ? href : baseUrl + href,
          title: title.substring(0, 150),
        });
      }
    }
  }

  // ============================================================
  // EXPAND SIDEBAR
  // ============================================================

  async function expandSidebar() {
    // Check if sidebar is already visible
    for (const sel of config.sidebar) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 100 && el.querySelectorAll("a").length > 2) {
        return;
      }
    }

    const toggleSelectors = [
      'button[aria-label*="menu" i]',
      'button[aria-label*="Menu" i]',
      'button[aria-label*="sidebar" i]',
      'button[aria-label*="navigation" i]',
      'button[aria-label*="Open" i]',
      '[class*="menu-button"]',
      '[class*="hamburger"]',
      '[class*="sidebar-toggle"]',
      '[class*="nav-toggle"]',
      '[data-test-id*="menu"]',
      '[data-test-id*="sidebar"]',
      'button[aria-expanded="false"]',
      '[class*="toggle"]',
      'header button:first-child',
      'button:has(svg)',
    ];

    for (const sel of toggleSelectors) {
      try {
        const btns = document.querySelectorAll(sel);
        for (const btn of btns) {
          const rect = btn.getBoundingClientRect();
          if (rect.top < 100 && rect.left < 200 && rect.width < 80 && rect.height < 80) {
            btn.click();
            await sleep(1000);
            for (const s of config.sidebar) {
              const el = document.querySelector(s);
              if (el && el.offsetHeight > 100) return;
            }
          }
        }
      } catch (e) {}
    }

    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true }));
      await sleep(800);
    } catch (e) {}
  }

  // ============================================================
  // WAIT FOR CONTENT (sync-safe: no navigation happens here)
  // ============================================================

  async function waitForContent(maxWait = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      let scroller = null;
      for (const sel of config.scroller) {
        scroller = document.querySelector(sel);
        if (scroller) break;
      }
      if (scroller) {
        const hasMsg = findFirst(scroller, [...config.userMsg, ...config.modelMsg]);
        if (hasMsg) return { ready: true, waited: Date.now() - start };
      }
      await sleep(300);
    }
    return { ready: false, waited: maxWait };
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  function getDomOrder(el) {
    if (!getDomOrder._cache) getDomOrder._cache = new WeakMap();
    if (getDomOrder._cache.has(el)) return getDomOrder._cache.get(el);
    const all = document.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      if (all[i] === el) { getDomOrder._cache.set(el, i); return i; }
    }
    return 0;
  }

  function extractTitle() {
    for (const sel of config.titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        if (text.length > 0 && text.length < 200) return text;
      }
    }
    return document.title.replace(/[-–|].*(Gemini|ChatGPT|Claude|DeepSeek|Copilot|Grok|Kimi|Meta AI|MiniMax|Manus|Zai).*/i, "").trim() || "Untitled";
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ============================================================
  // WORD-BY-WORD CAPTURE
  // ============================================================

  let isCapturing = false, capturedWords = [], observer = null;

  function startWordCapture() {
    isCapturing = true; capturedWords = [];
    let target = null;
    for (const sel of config.scroller) { target = document.querySelector(sel); if (target) break; }
    if (!target) target = document.body;

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target.textContent) {
          m.target.textContent.split(/(\s+)/).forEach(w => { if (w.trim()) capturedWords.push({ word: w.trim(), timestamp: Date.now() }); });
        }
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent.split(/(\s+)/).forEach(w => { if (w.trim()) capturedWords.push({ word: w.trim(), timestamp: Date.now() }); });
          }
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return { status: "capturing" };
  }

  function stopWordCapture() {
    isCapturing = false;
    if (observer) { observer.disconnect(); observer = null; }
    return { status: "stopped", words: capturedWords, wordCount: capturedWords.length };
  }

  // ============================================================
  // MESSAGE LISTENER — FIXED: no more channel-closed errors
  // ============================================================
  //
  // KEY FIX: For actions that trigger navigation (navigateToChat),
  // we respond SYNCHRONOUSLY and do the work after.
  // For async actions, we wrap in try/catch/finally to ALWAYS call sendResponse.
  // ============================================================

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const action = request.action;

    // ---- SYNC actions (respond immediately, no navigation) ----
    if (action === "extract") {
      try { sendResponse(extractConversation()); }
      catch (e) { sendResponse({ error: e.message }); }
      return false; // sync, no need to keep channel open
    }

    if (action === "startCapture") {
      try { sendResponse(startWordCapture()); }
      catch (e) { sendResponse({ error: e.message }); }
      return false;
    }

    if (action === "stopCapture") {
      try { sendResponse(stopWordCapture()); }
      catch (e) { sendResponse({ error: e.message }); }
      return false;
    }

    if (action === "getCaptureStatus") {
      sendResponse({ isCapturing, wordCount: capturedWords.length });
      return false;
    }

    if (action === "ping") {
      sendResponse({ platform: PLATFORM, platformName: config.name, ready: true, url: window.location.href });
      return false;
    }

    // ---- ASYNC actions (keep channel open, always respond) ----
    if (action === "collectAllChats") {
      collectAllChats()
        .then(r => { try { sendResponse(r); } catch(e) {} })
        .catch(e => { try { sendResponse({ error: e.message, total: 0, chats: [] }); } catch(e2) {} });
      return true;
    }

    if (action === "waitForContent") {
      waitForContent(request.maxWait || 10000)
        .then(r => { try { sendResponse(r); } catch(e) {} })
        .catch(e => { try { sendResponse({ ready: false, error: e.message }); } catch(e2) {} });
      return true;
    }

    // ---- NAVIGATION: respond BEFORE navigating to avoid channel death ----
    if (action === "navigateToChat") {
      // Respond immediately — the navigation will kill this context
      sendResponse({ navigating: true });

      // Do the navigation AFTER responding (fire and forget)
      setTimeout(() => {
        try {
          const targetUrl = request.url;
          // Try clicking sidebar link first (SPA navigation)
          const links = document.querySelectorAll(config.chatLinks);
          let clicked = false;
          for (const link of links) {
            const href = link.getAttribute("href") || link.href || "";
            if (href === targetUrl || link.href === targetUrl || targetUrl.endsWith(href)) {
              link.click();
              clicked = true;
              break;
            }
          }
          // Fallback: direct URL change
          if (!clicked) {
            window.location.href = targetUrl;
          }
        } catch (e) {
          // Context might already be dead, that's fine
        }
      }, 50);

      return false; // We already responded synchronously
    }

    // Unknown action
    sendResponse({ error: "Unknown action: " + action });
    return false;
  });

  console.log(`[AI Session Extractor] ${config.name} content script v4.1 loaded (${PLATFORM})`);
})();
