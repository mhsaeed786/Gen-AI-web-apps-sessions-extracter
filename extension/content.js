// ============================================================
// AI Session Extractor - Multi-Platform Content Script v5.0
// Built from real DOM dumps of ChatGPT, Claude, Copilot, DeepSeek, Gemini,
// Grok, Kimi, Meta AI, MiniMax, Mistral, Perplexity, Pi, Qwen, Zai
// ============================================================

(function () {
  "use strict";

  if (window.__AI_EXTRACTOR_LOADED__) {
    console.log("[AI Session Extractor] Already loaded, skipping re-injection");
    return;
  }
  window.__AI_EXTRACTOR_LOADED__ = true;

  // ============================================================
  // PLATFORM DETECTION
  // ============================================================
  function detectPlatform() {
    const host = location.hostname.toLowerCase();
    const url = window.location.href.toLowerCase();

    if (host.includes("gemini.google.com")) return "gemini";
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("chat.deepseek.com")) return "deepseek";
    if (host.includes("copilot.microsoft.com")) return "copilot";
    if (host.includes("grok.com") || url.includes("x.com/i/grok")) return "grok";
    if (host.includes("kimi.moonshot.cn") || host.includes("kimi.com")) return "kimi";
    if (host.includes("meta.ai")) return "metaai";
    if (host.includes("hailuoai.com") || host.includes("minimax.io") || host.includes("minimax.chat")) return "minimax";
    if (host.includes("manus.im") || host.includes("manus.app")) return "manus";
    if (host.includes("chat.z.ai") || host.includes("z.ai")) return "zai";
    if (host.includes("perplexity.ai")) return "perplexity";
    if (host.includes("poe.com")) return "poe";
    if (host.includes("chat.mistral.ai")) return "mistral";
    if (host.includes("chatglm.cn")) return "chatglm";
    if (host.includes("tongyi.aliyun.com")) return "qwen";
    if (host.includes("chat.qwen.ai") || host.includes("coder.qwen.ai")) return "qwen";
    if (host.includes("pi.ai")) return "pi";
    if (host.includes("jules.google.com")) return "jules";
    if (host.includes("you.com")) return "you";
    if (host.includes("huggingface.co")) return "huggingface";
    if (host.includes("character.ai")) return "character";
    if (host.includes("chat.reka.ai")) return "reka";

    // Heuristic fallback
    const bodyText = document.body?.innerText?.toLowerCase() || "";
    if (url.includes("/c/") && bodyText.includes("chatgpt")) return "chatgpt";
    if (url.includes("/chat/") && bodyText.includes("claude")) return "claude";
    return "generic";
  }

  const PLATFORM = detectPlatform();

  // ============================================================
  // PLATFORM SELECTOR CONFIGS
  // ============================================================
  const PLATFORMS = {
    gemini: {
      name: "Gemini",
      scroller: ['infinite-scroller[data-test-id="chat-history-container"]', '[class*="chat-history-scroll"]', 'infinite-scroller'],
      userMsg: ["user-query", '[class*="user-query"]', ".query-text", '[class*="query-text"]', '[class*="user-message"]'],
      modelMsg: ["model-response", "model-response-primary", '[class*="model-response"]', '[class*="response"]:not([class*="response-tts"])'],
      msgContainer: ['.conversation-container', '[class*="conversation-container"]'],
      sidebar: ['[data-test-id="all-conversations"]', 'conversations-list', '[data-test-id="chats-expandable-section"]', '[class*="conversation-list"]'],
      chatLinks: '[data-test-id="conversation"] a, a[href*="/app/"]',
      chatUrlPattern: /\/app\/([a-f0-9]+)/i,
      titleSelectors: ['[class*="conversation-title"]', '[class*="chat-title"]', 'h1'],
    },

    chatgpt: {
      name: "ChatGPT",
      scroller: ['[data-testid="conversation-turn-list"]', '[class*="conversation-turn-list"]', 'main article', 'main'],
      userMsg: ['[data-message-author-role="user"]', '[class*="user-message"]'],
      modelMsg: ['[data-message-author-role="assistant"]', '[class*="assistant-message"]', '[class*="markdown"]'],
      msgContainer: ['[data-message-author-role]'],
      sidebar: ['[class*="sidebar"]', 'nav', '[data-testid="sidebar"]'],
      chatLinks: 'nav a[href*="/c/"], a[href*="/c/"]',
      chatUrlPattern: /\/c\/([a-f0-9-]+)/i,
      titleSelectors: ['[data-testid="conversation-name"]', 'h1', 'title'],
    },

    claude: {
      name: "Claude",
      scroller: ['[class*="conversation"]', '[class*="messages"]', 'main'],
      userMsg: ['[data-testid="user-message"]', '[class*="user-message"]', '[class*="human-message"]'],
      modelMsg: ['[data-testid="assistant-message"]', '[class*="assistant-message"]', '[class*="claude-message"]', '[class*="markdown"]'],
      msgContainer: ['[class*="message-row"]', '[class*="message"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['h1', '[class*="title"]', 'title'],
    },

    deepseek: {
      name: "DeepSeek",
      scroller: ['[class*="chat-list"]', '[class*="message-list"]', 'main'],
      userMsg: ['[class*="message-user"]', '[class*="user-message"]', '[data-role="user"]'],
      modelMsg: ['[class*="message-assistant"]', '[class*="assistant-message"]', '[data-role="assistant"]', '[class*="ds-markdown"]'],
      msgContainer: ['[class*="chat-item"]', '[class*="message-item"]'],
      sidebar: ['[class*="sidebar"]', '[class*="chat-history"]'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    copilot: {
      name: "Copilot",
      scroller: ['[class*="conversation"]', '[class*="chat-pane"]', 'main'],
      userMsg: ['[class*="user-message"]', '[class*="message-user"]', '[data-content="user"]'],
      modelMsg: ['[class*="bot-message"]', '[class*="assistant-message"]', '[class*="response"]', '[class*="markdown"]'],
      msgContainer: ['[class*="ac-container"]', '[class*="message"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/search/"], a[href*="/chat/"]',
      chatUrlPattern: /\/(?:search|chat)\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    grok: {
      name: "Grok",
      scroller: ['[class*="conversation"]', '[class*="chat"] [class*="messages"]', 'main'],
      userMsg: ['[data-testid="user-message"]', '[class*="user-message"]'],
      modelMsg: ['[data-testid="model-response"]', '[class*="model-response"]', '[class*="assistant-message"]', '[class*="markdown"]'],
      msgContainer: ['[class*="message-bubble"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/c/"], a[href*="/chat/"]',
      chatUrlPattern: /\/(?:c|chat)\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    kimi: {
      name: "Kimi",
      scroller: ['[class*="chat-content"]', '[class*="message-list"]'],
      userMsg: ['[class*="chat-content-item-user"]', '[class*="user-message"]'],
      modelMsg: ['[class*="chat-content-item-assistant"]', '[class*="assistant-message"]', '[class*="markdown-container"]'],
      msgContainer: ['[class*="chat-content-item"]'],
      sidebar: ['[class*="sidebar"]', '[class*="next-sidebar"]'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    metaai: {
      name: "Meta AI",
      scroller: ['[class*="conversation"]', 'main'],
      userMsg: ['[class*="user-message"]', '[class*="group/user-message"]'],
      modelMsg: ['[class*="assistant-message"]', '[class*="group/assistant-message"]', '[class*="markdown-content"]'],
      msgContainer: ['[data-testid*="message"]', '[class*="group/message"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/chat/"], a[href*="/prompt/"]',
      chatUrlPattern: /\/(?:chat|prompt)\/([a-f0-9-]+)/i,
      titleSelectors: ['[data-testid*="conversation-name"]', 'h1'],
    },

    minimax: {
      name: "MiniMax",
      scroller: ['[class*="message-container-chat-content"]', '[class*="chat-content"]'],
      userMsg: ['[class*="message-container-user-text"]', '[class*="user-text"]'],
      modelMsg: ['[class*="matrix-markdown"]', '[class*="message-content"]', '[data-testid*="assistant"]'],
      msgContainer: ['[class*="message-container"]'],
      sidebar: ['[class*="sidebar"]', '[class*="chat-list"]'],
      chatLinks: 'a[href*="/chat/"], a[href*="/agent/"]',
      chatUrlPattern: /\/(?:chat|agent)\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    manus: {
      name: "Manus",
      scroller: ['[class*="chat"]', '[class*="conversation"]', 'main'],
      userMsg: ['[class*="user-message"]', '[class*="human-message"]'],
      modelMsg: ['[class*="assistant-message"]', '[class*="agent-message"]', '[class*="markdown"]'],
      msgContainer: ['[class*="message"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/task/"], a[href*="/chat/"]',
      chatUrlPattern: /\/(?:task|chat)\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    zai: {
      name: "Zai",
      scroller: ['[class*="chat-assistant"]', '[class*="chat-user"]', 'main'],
      userMsg: ['[class*="user-message"]', '[class*="chat-user"]'],
      modelMsg: ['[class*="assistant-message"]', '[class*="chat-assistant"]', '[class*="markdown-prose"]'],
      msgContainer: ['[class*="message"]'],
      sidebar: ['[class*="sidebar"]', 'nav', '[class*="AgentChatList"]'],
      chatLinks: 'a[href*="/c/"]',
      chatUrlPattern: /\/c\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    perplexity: {
      name: "Perplexity",
      scroller: ['[class*="thread-content"]', '[class*="Content"]'],
      userMsg: ['[class*="query"]', '[class*="user-message"]'],
      modelMsg: ['[class*="answer"]', '[class*="assistant-message"]', '[class*="prose"]'],
      msgContainer: ['[class*="Thread"]'],
      sidebar: ['[class*="sidebar"]', '[class*="thread-list"]'],
      chatLinks: 'a[href*="/search/"], a[href*="/thread/"]',
      chatUrlPattern: /\/(?:search|thread)\/([a-zA-Z0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    poe: {
      name: "Poe",
      scroller: ['[class*="chat"]', '[class*="messages"]', 'main'],
      userMsg: ['[class*="user"]'],
      modelMsg: ['[class*="bot"]', '[class*="assistant"]', '[class*="message"]'],
      msgContainer: ['[class*="message"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-zA-Z0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    mistral: {
      name: "Mistral",
      scroller: ['[class*="conversation"]', 'main'],
      userMsg: ['[data-message-author-role="user"]', '[class*="user-message"]'],
      modelMsg: ['[data-message-author-role="assistant"]', '[class*="assistant-message"]', '[class*="markdown-container-style"]'],
      msgContainer: ['[data-message-author-role]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/chat/"]',
      chatUrlPattern: /\/chat\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    qwen: {
      name: "Qwen",
      scroller: ['[class*="chat-messages"]', '[class*="chat-container"]'],
      userMsg: ['[class*="qwen-chat-message-user"]', '[class*="chat-message-user"]'],
      modelMsg: ['[class*="qwen-chat-message-assistant"]', '[class*="chat-message-assistant"]', '[class*="custom-qwen-markdown"]'],
      msgContainer: ['[class*="qwen-chat-message"]', '[class*="chat-viewer-messages"]'],
      sidebar: ['[class*="sidebar"]', '[class*="chat-list"]'],
      chatLinks: 'a[href*="/c/"], a[href*="/chat/"]',
      chatUrlPattern: /\/(?:c|chat)\/([a-f0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    pi: {
      name: "Pi",
      scroller: ['[class*="t-body-chat"]', 'main'],
      userMsg: ['[class*="user-message"]', '[class*="from-user"]'],
      modelMsg: ['[class*="bot-message"]', '[class*="from-pi"]'],
      msgContainer: ['[class*="message"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/talk/"]',
      chatUrlPattern: /\/talk\/([a-zA-Z0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    jules: {
      name: "Jules",
      scroller: ['[class*="main-content"]', 'main'],
      userMsg: ['[class*="user-message"]', '[class*="prompt"]'],
      modelMsg: ['[class*="assistant-message"]', '[class*="response"]', '[class*="markdown"]'],
      msgContainer: ['[class*="message"]'],
      sidebar: ['[class*="sidebar"]', 'nav'],
      chatLinks: 'a[href*="/repo/"]',
      chatUrlPattern: /\/repo\/([a-zA-Z0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1'],
    },

    generic: {
      name: "AI Chat",
      scroller: ['main', '[class*="chat"]', '[class*="conversation"]', '[class*="messages"]', '[role="main"]'],
      userMsg: ['[class*="user"]', '[class*="human"]', '[class*="question"]', '[data-role="user"]', '[data-message-author-role="user"]', '[data-author="user"]'],
      modelMsg: ['[class*="assistant"]', '[class*="bot"]', '[class*="ai"]', '[class*="response"]', '[class*="answer"]', '[class*="markdown"]', '[data-role="assistant"]', '[data-message-author-role="assistant"]', '[data-author="assistant"]'],
      msgContainer: ['[class*="message"]', '[class*="turn"]'],
      sidebar: ['[class*="sidebar"]', 'nav', '[class*="history"]'],
      chatLinks: 'a[href*="/chat/"], a[href*="/c/"], a[href*="/conversation/"], a[href*="/search/"]',
      chatUrlPattern: /\/(?:chat|c|conversation|search|talk)\/([a-zA-Z0-9-]+)/i,
      titleSelectors: ['[class*="title"]', 'h1', 'title'],
    },
  };

  const config = PLATFORMS[PLATFORM] || PLATFORMS.generic;

  // ============================================================
  // EXTRACTION ENGINE
  // ============================================================
  function extractConversation() {
    const messages = [];

    let scroller = null;
    for (const sel of config.scroller) { scroller = document.querySelector(sel); if (scroller) break; }

    if (scroller) extractFromContainer(scroller, messages);
    if (messages.length === 0) extractViaDirectQueries(messages);
    if (messages.length === 0) extractViaBroadScan(messages);
    if (messages.length === 0) return null;

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
      if (/zero-state|banner|disclaimer|sidebar|nav|header|footer|input|composer|toolbar/i.test(cls)) continue;

      const userEl = findFirst(child, config.userMsg);
      if (userEl) {
        const text = extractFullText(userEl);
        if (text.trim().length > 0) messages.push({ role: "user", content: text.trim(), timestamp: null, _domOrder: getDomOrder(userEl) });
      }

      const modelEl = findFirst(child, config.modelMsg);
      if (modelEl) {
        const text = extractFullText(modelEl);
        if (text.trim().length > 0) messages.push({ role: "model", content: text.trim(), timestamp: null, _domOrder: getDomOrder(modelEl) });
      }

      if (!userEl && !modelEl && config.msgContainer && config.msgContainer.length) {
        const containerEl = findFirst(child, config.msgContainer);
        if (containerEl) {
          const text = extractFullText(containerEl);
          if (text.trim().length > 20) {
            const guessRole = guessMessageRole(containerEl);
            messages.push({ role: guessRole, content: text.trim(), timestamp: null, _domOrder: getDomOrder(containerEl) });
          }
        }
      }
    }
  }

  function extractViaDirectQueries(messages) {
    const allEls = [];
    for (const sel of config.userMsg) document.querySelectorAll(sel).forEach((el) => allEls.push({ el, role: "user" }));
    for (const sel of config.modelMsg) document.querySelectorAll(sel).forEach((el) => allEls.push({ el, role: "model" }));
    allEls.sort((a, b) => getDomOrder(a.el) - getDomOrder(b.el));
    for (const { el, role } of allEls) {
      const text = extractFullText(el);
      if (text.trim().length > 0) messages.push({ role, content: text.trim(), timestamp: null, _domOrder: getDomOrder(el) });
    }
  }

  function extractViaBroadScan(messages) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const cls = (node.className || "").toString().toLowerCase();
        const role = node.getAttribute("data-role") || node.getAttribute("data-message-author-role") || "";
        const tag = node.tagName.toLowerCase();
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
      const role = guessMessageRole(node);
      const text = extractFullText(node);
      if (text.trim().length > 10) {
        messages.push({ role, content: text.trim(), timestamp: null, _domOrder: getDomOrder(node) });
      }
    }
  }

  function guessMessageRole(el) {
    const cls = (el.className || "").toString().toLowerCase();
    const role = el.getAttribute("data-role") || el.getAttribute("data-message-author-role") || "";
    if (/user|human|question/i.test(cls) || /user/i.test(role)) return "user";
    if (/assistant|bot|model|response|answer|markdown/i.test(cls) || /assistant/i.test(role)) return "model";
    // DOM-order fallback: odd/even based on platform context often works
    return "model";
  }

  function findFirst(parent, selectors) {
    for (const sel of selectors) {
      try {
        const el = parent.querySelector(sel);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  function deduplicateMessages(messages) {
    for (let i = messages.length - 1; i >= 1; i--) {
      const curr = messages[i].content;
      const prev = messages[i - 1].content;
      if (curr === prev) { messages.splice(i, 1); continue; }
      if (curr.includes(prev) && curr.length > prev.length * 0.8) messages.splice(i - 1, 1);
      else if (prev.includes(curr) && prev.length > curr.length * 0.8) messages.splice(i, 1);
    }
  }

  // ============================================================
  // TEXT EXTRACTION
  // ============================================================
  function extractFullText(element) {
    if (!element) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll("button, [class*='button'], [class*='action'], [class*='toolbar'], [class*='copy'], [class*='tts'], [class*='feedback'], [class*='rating'], [class*='share'], svg, [class*='icon'], [class*='menu'], [role='menu']").forEach((el) => el.remove());
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
      if (parent && parent.tagName.toLowerCase() === "ol") prefix = "\n" + (Array.from(parent.children).indexOf(node) + 1) + ". ";
      else prefix = "\n- ";
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
  // DOM DUMP (for selector discovery)
  // ============================================================
  function dumpDOM() {
    const dump = {
      meta: {
        platform: PLATFORM,
        platformName: config.name,
        url: window.location.href,
        host: location.hostname,
        title: document.title,
        scrapedAt: new Date().toISOString(),
        bodyClasses: document.body.className,
      },
      messages: {},
      sidebar: {},
      scrollers: [],
      customElements: [],
      dataAttributes: [],
      classPatterns: [],
      sampleHTML: [],
      extractedMessages: [],
    };

    const msgSelectors = [
      '[class*="message"]', '[class*="Message"]', '[class*="chat"]', '[class*="Chat"]',
      '[class*="conversation"]', '[class*="Conversation"]', '[class*="turn"]', '[class*="Turn"]',
      '[class*="response"]', '[class*="Response"]', '[class*="query"]', '[class*="Query"]',
      '[class*="prompt"]', '[class*="Prompt"]', '[class*="answer"]', '[class*="Answer"]',
      '[class*="user"]', '[class*="User"]', '[class*="assistant"]', '[class*="Assistant"]',
      '[class*="model"]', '[class*="Model"]', '[class*="human"]', '[class*="Human"]',
      '[class*="bot"]', '[class*="Bot"]', '[class*="markdown"]', '[class*="Markdown"]',
      '[class*="content"]', '[class*="Content"]', '[class*="text"]', '[class*="Text"]',
      '[class*="bubble"]', '[class*="Bubble"]',
      '[data-message-author-role]', '[data-role]', '[data-testid*="message"]', '[data-testid*="conversation"]',
      '[data-testid*="chat"]', '[data-testid*="user"]', '[data-testid*="assistant"]',
      'user-query', 'model-response', 'model-response-primary', 'cib-message', 'cib-message-group', 'cib-conversation',
      '[role="log"]', '[role="article"]', '[aria-label*="message"]', '[aria-label*="Message"]',
    ];

    for (const sel of msgSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length > 0 && els.length < 500) {
          dump.messages[sel] = {
            count: els.length,
            samples: Array.from(els).slice(0, 5).map((el) => ({
              tag: el.tagName.toLowerCase(), id: el.id || null,
              className: (el.className || "").toString().substring(0, 200),
              dataAttrs: Object.keys(el.dataset).slice(0, 10),
              text: (el.textContent || "").substring(0, 150).trim(),
              childCount: el.children.length,
              rect: el.getBoundingClientRect ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null,
            })),
          };
        }
      } catch (e) {}
    }

    const sidebarSelectors = [
      'nav', '[class*="sidebar"]', '[class*="Sidebar"]', '[class*="history"]', '[class*="History"]',
      '[class*="conversation-list"]', '[class*="chat-list"]', '[data-testid*="conversation"]',
      '[data-testid*="history"]', '[data-testid*="sidebar"]', '[data-testid*="nav"]',
    ];

    for (const sel of sidebarSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length > 0 && els.length < 50) {
          dump.sidebar[sel] = {
            count: els.length,
            samples: Array.from(els).slice(0, 3).map((el) => ({
              tag: el.tagName.toLowerCase(), className: (el.className || "").toString().substring(0, 200),
              childCount: el.children.length,
              links: Array.from(el.querySelectorAll("a")).slice(0, 10).map((a) => ({
                href: (a.getAttribute("href") || "").substring(0, 100),
                text: (a.textContent || "").substring(0, 60).trim(),
              })),
            })),
          };
        }
      } catch (e) {}
    }

    const allEls = document.querySelectorAll("*");
    for (const el of allEls) {
      if (el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 200) {
        dump.scrollers.push({ tag: el.tagName.toLowerCase(), id: el.id || null, className: (el.className || "").toString().substring(0, 150), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, childCount: el.children.length, dataTestId: el.getAttribute("data-testid") || null });
      }
      if (dump.scrollers.length >= 15) break;
    }

    const customSet = new Set();
    for (const el of allEls) if (el.tagName.includes("-")) customSet.add(el.tagName.toLowerCase());
    dump.customElements = Array.from(customSet).sort();

    const dataAttrSet = new Set();
    for (const el of Array.from(allEls).slice(0, 3000)) for (const attr of el.attributes) if (attr.name.startsWith("data-")) dataAttrSet.add(attr.name);
    dump.dataAttributes = Array.from(dataAttrSet).sort();

    const classCount = {};
    for (const el of Array.from(allEls).slice(0, 5000)) {
      const cls = (el.className || "").toString();
      if (cls && /msg|message|chat|user|assistant|model|human|bot|query|response|answer|content|text|turn|bubble/i.test(cls)) {
        const key = cls.substring(0, 100);
        classCount[key] = (classCount[key] || 0) + 1;
      }
    }
    dump.classPatterns = Object.entries(classCount).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([cls, count]) => ({ class: cls, count }));

    for (const sel of ['[data-message-author-role]', '[class*="message"]', '[class*="Message"]', '[class*="turn"]', '[class*="query"]', '[class*="response"]', '[class*="markdown"]']) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        dump.sampleHTML.push({ selector: sel, count: els.length, outerHTML: els[0].outerHTML.substring(0, 2000) });
        if (dump.sampleHTML.length >= 5) break;
      }
    }

    // Extract actual visible messages using platform selectors
    const extracted = extractConversation();
    if (extracted) dump.extractedMessages = extracted.messages.slice(0, 20);

    return dump;
  }

  // ============================================================
  // ALL-CHATS: Collect sidebar links
  // ============================================================
  async function collectAllChats() {
    const chats = []; const seen = new Set();
    await expandSidebar();

    let sidebarScroll = null;
    for (const sel of config.sidebar) { sidebarScroll = document.querySelector(sel); if (sidebarScroll) break; }
    if (!sidebarScroll) sidebarScroll = document.querySelector('[class*="drawer"]') || document.querySelector('[class*="panel"]') || document.querySelector('[role="navigation"]');

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

    collectLinks(document, chats, seen);

    // Gemini-specific aggressive expansion
    if (PLATFORM === "gemini" && chats.length < 5) {
      const expandBtns = document.querySelectorAll('[class*="expand"], [class*="show-more"], [class*="see-all"], button[aria-expanded="false"]');
      for (const btn of expandBtns) {
        const text = (btn.textContent || "").toLowerCase();
        if (/show|expand|more|all|recent/i.test(text) || btn.getAttribute("aria-expanded") === "false") {
          btn.click(); await sleep(1000);
        }
      }
      collectLinks(document, chats, seen);
      if (sidebarScroll) {
        for (let i = 0; i < 30; i++) { collectLinks(sidebarScroll, chats, seen); sidebarScroll.scrollTop = sidebarScroll.scrollHeight; await sleep(400); }
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
        chats.push({ id: match[1], url: href.startsWith("http") ? href : baseUrl + href, title: title.substring(0, 150) });
      }
    }
  }

  // ============================================================
  // EXPAND SIDEBAR
  // ============================================================
  async function expandSidebar() {
    for (const sel of config.sidebar) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 100 && el.querySelectorAll("a").length > 2) return;
    }

    const toggleSelectors = [
      'button[aria-label*="menu" i]', 'button[aria-label*="Menu" i]', 'button[aria-label*="sidebar" i]',
      'button[aria-label*="navigation" i]', 'button[aria-label*="Open" i]', '[class*="menu-button"]',
      '[class*="hamburger"]', '[class*="sidebar-toggle"]', '[class*="nav-toggle"]', '[data-test-id*="menu"]',
      '[data-test-id*="sidebar"]', 'button[aria-expanded="false"]', '[class*="toggle"]', 'header button:first-child',
    ];

    for (const sel of toggleSelectors) {
      try {
        const btns = document.querySelectorAll(sel);
        for (const btn of btns) {
          const rect = btn.getBoundingClientRect();
          if (rect.top < 100 && rect.left < 200 && rect.width < 80 && rect.height < 80) {
            btn.click(); await sleep(1000);
            for (const s of config.sidebar) { const el = document.querySelector(s); if (el && el.offsetHeight > 100) return; }
          }
        }
      } catch (e) {}
    }

    try { document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true })); await sleep(800); } catch (e) {}
  }

  // ============================================================
  // WAIT FOR CONTENT
  // ============================================================
  async function waitForContent(maxWait = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      let scroller = null;
      for (const sel of config.scroller) { scroller = document.querySelector(sel); if (scroller) break; }
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
    for (let i = 0; i < all.length; i++) { if (all[i] === el) { getDomOrder._cache.set(el, i); return i; } }
    return 0;
  }

  function extractTitle() {
    for (const sel of config.titleSelectors) {
      const el = document.querySelector(sel);
      if (el) { const text = el.textContent.trim(); if (text.length > 0 && text.length < 200) return text; }
    }
    return document.title.replace(/[-–|].*(Gemini|ChatGPT|Claude|DeepSeek|Copilot|Grok|Kimi|Meta AI|MiniMax|Manus|Zai|Perplexity).*/i, "").trim() || "Untitled";
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
          m.target.textContent.split(/(\s+)/).forEach((w) => { if (w.trim()) capturedWords.push({ word: w.trim(), timestamp: Date.now() }); });
        }
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent.split(/(\s+)/).forEach((w) => { if (w.trim()) capturedWords.push({ word: w.trim(), timestamp: Date.now() }); });
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
  // MESSAGE LISTENER — FIXED
  // ============================================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const action = request.action;

    function respond(data) {
      try { sendResponse(data); } catch (e) { window.__LAST_RESPONSE__ = data; }
    }

    try {
      if (action === "extract") { respond(extractConversation()); return false; }
      if (action === "startCapture") { respond(startWordCapture()); return false; }
      if (action === "stopCapture") { respond(stopWordCapture()); return false; }
      if (action === "getCaptureStatus") { respond({ isCapturing, wordCount: capturedWords.length }); return false; }
      if (action === "ping") { respond({ platform: PLATFORM, platformName: config.name, ready: true, url: window.location.href }); return false; }

      if (action === "collectAllChats") {
        collectAllChats().then((r) => respond(r)).catch((e) => respond({ error: e.message, total: 0, chats: [] }));
        return true;
      }

      if (action === "waitForContent") {
        waitForContent(request.maxWait || 10000).then((r) => respond(r)).catch((e) => respond({ ready: false, error: e.message }));
        return true;
      }

      if (action === "dumpDOM") {
        (async () => {
          const r = dumpDOM();
          window.__LAST_DOM_DUMP__ = r;
          respond(r);
        })();
        return true;
      }

      if (action === "navigateToChat") {
        respond({ navigating: true });
        setTimeout(() => {
          try {
            const targetUrl = request.url;
            const links = document.querySelectorAll(config.chatLinks);
            for (const link of links) {
              const href = link.getAttribute("href") || link.href || "";
              if (href === targetUrl || link.href === targetUrl || targetUrl.endsWith(href)) {
                link.click(); return;
              }
            }
            window.location.href = targetUrl;
          } catch (e) {}
        }, 50);
        return false;
      }

      respond({ error: "Unknown action: " + action });
      return false;
    } catch (e) {
      respond({ error: e.message });
      return false;
    }
  });

  console.log(`[AI Session Extractor] ${config.name} content script v5.0 loaded (${PLATFORM})`);
})();
