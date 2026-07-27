// ============================================================
// ALL AI CHAT PLATFORMS - Run the DOM scraper on each
// ============================================================
// INSTRUCTIONS:
// 1. Open each URL below in your browser (log in if needed)
// 2. Open a conversation with some messages
// 3. Press F12 → Console → type "allow pasting" → Enter
// 4. Paste the contents of DOM-SCRAPER-UNIVERSAL.js → Enter
// 5. A JSON file downloads — share it with me
// ============================================================

const AI_PLATFORMS = [
  // ---- TIER 1: Major ----
  { name: "Gemini",        url: "https://gemini.google.com/app" },
  { name: "ChatGPT",       url: "https://chatgpt.com/" },
  { name: "Claude",        url: "https://claude.ai/" },
  { name: "DeepSeek",      url: "https://chat.deepseek.com/" },
  { name: "Copilot",       url: "https://copilot.microsoft.com/" },
  { name: "Grok",          url: "https://grok.com/" },

  // ---- TIER 2: Popular ----
  { name: "Kimi",          url: "https://kimi.moonshot.cn/" },
  { name: "Meta AI",       url: "https://www.meta.ai/" },
  { name: "MiniMax/Hailuo",url: "https://hailuoai.com/" },
  { name: "Perplexity",    url: "https://www.perplexity.ai/" },
  { name: "Poe",           url: "https://poe.com/" },
  { name: "Mistral",       url: "https://chat.mistral.ai/" },

  // ---- TIER 3: Others ----
  { name: "Manus",         url: "https://manus.im/" },
  { name: "Z.ai",          url: "https://z.ai/" },
  { name: "Pi",            url: "https://pi.ai/talk" },
  { name: "HuggingChat",   url: "https://huggingface.co/chat/" },
  { name: "You.com",       url: "https://you.com/chat" },
  { name: "Phind",         url: "https://www.phind.com/" },
  { name: "Character.AI",  url: "https://character.ai/" },
  { name: "Cohere Coral",  url: "https://coral.cohere.com/" },

  // ---- TIER 4: Coding AI ----
  { name: "Cursor",        url: "(desktop app - no web)" },
  { name: "Windsurf",      url: "(desktop app - no web)" },
  { name: "Cody",          url: "https://sourcegraph.com/cody/chat" },
  { name: "Codeium",       url: "https://codeium.com/chat" },
  { name: "Tabnine",       url: "https://app.tabnine.com/" },

  // ---- TIER 5: Writing/Content AI ----
  { name: "Jasper",        url: "https://app.jasper.ai/chat" },
  { name: "Copy.ai",       url: "https://www.copy.ai/chat" },
  { name: "Writesonic",    url: "https://app.writesonic.com/" },
  { name: "Rytr",          url: "https://app.rytr.me/" },

  // ---- TIER 6: Chinese AI ----
  { name: "Qwen/Tongyi",   url: "https://tongyi.aliyun.com/" },
  { name: "ERNIE/Wenxin",  url: "https://yiyan.baidu.com/" },
  { name: "Doubao",        url: "https://www.doubao.com/" },
  { name: "Zhipu/GLM",     url: "https://chatglm.cn/" },
  { name: "Xunfei Spark",  url: "https://xinghuo.xfyun.cn/" },
  { name: "Baichuan",      url: "https://www.baichuan-ai.com/" },
  { name: "Yi/01.AI",      url: "https://www.wanzhi.com/" },
  { name: "StepFun",       url: "https://www.stepfun.com/" },
  { name: "Moonshot Kimi", url: "https://kimi.moonshot.cn/" },

  // ---- TIER 7: Research/Specialized ----
  { name: "Consensus",     url: "https://consensus.app/" },
  { name: "Elicit",        url: "https://elicit.com/" },
  { name: "Scite",         url: "https://scite.ai/" },
  { name: "Tavily",        url: "https://app.tavily.com/" },
];

// Print summary
console.table(AI_PLATFORMS.map(p => ({ Platform: p.name, URL: p.url })));
console.log(`\nTotal: ${AI_PLATFORMS.length} platforms`);
console.log("\nRun DOM-SCRAPER-UNIVERSAL.js on each one (while in a conversation)");
console.log("Share the downloaded JSON files to get accurate selectors!");
