# AI Session Extractor

A Chrome extension that extracts complete AI chat sessions word-by-word from many AI web apps.

> **Current status:** v1.0 — active development happens on `feature/improvements`. `master` is the organized, clean-architecture release branch.

---

## ✨ What it does

- Extract a single conversation from the active tab.
- Extract **all** conversations from one platform tab by scrolling the sidebar and opening each chat.
- Extract from **all open AI tabs at once** across multiple platforms.
- Live word-by-word capture as the AI streams responses.
- Export as **TXT**, **Markdown**, **JSON**, or **CSV**.
- Dump DOM structures from every open AI tab to help build accurate selectors for new platforms.

---

## 🌐 Supported platforms

| Platform | Single chat | All chats | DOM dump |
|----------|-------------|-----------|----------|
| Gemini | ✓ | ✓ | ✓ |
| ChatGPT | ✓ | ✓ | ✓ |
| Claude | ✓ | ✓ | ✓ |
| DeepSeek | ✓ | ✓ | ✓ |
| Copilot | ✓ | partial | ✓ |
| Grok | ✓ | partial | ✓ |
| Kimi | ✓ | partial | ✓ |
| Meta AI | ✓ | partial | ✓ |
| MiniMax / Hailuo | ✓ | partial | ✓ |
| Manus | ✓ | partial | ✓ |
| Zai | ✓ | partial | ✓ |
| Perplexity | ✓ | partial | ✓ |
| Poe | ✓ | partial | ✓ |
| Mistral | ✓ | partial | ✓ |
| Qwen | ✓ | partial | ✓ |
| Pi | ✓ | partial | ✓ |
| Jules | ✓ | partial | ✓ |
| Generic fallback | ✓ | partial | ✓ |

For platforms not listed, the extension uses a generic DOM scanner.

---

## 📁 Repository structure

```
ai-session-extractor/
├── extension/              # The actual Chrome extension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── content-styles.css
│   ├── popup.html
│   ├── popup.js
│   ├── popup-styles.css
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── tools/                  # Helper scripts for selector discovery
│   ├── DOM-SCRAPER-UNIVERSAL.js
│   ├── PASTE-IN-CONSOLE.js
│   ├── VERIFY-IN-CONSOLE.js
│   ├── console-dump-script.js
│   ├── scrape-gemini-dom.js
│   └── copy-profile.ps1
├── docs/
│   └── ALL-PLATFORMS.js    # Reference list of AI platforms
├── data/
│   └── dom-dumps/          # Saved DOM dumps for analysis
├── screenshots/            # Place screenshots here
├── tests/                  # Place automated/manual tests here
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Install (load unpacked)

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `extension/` folder from this repository.
5. The extension icon should appear in your toolbar.

---

## 🛠 How to use

### Extract the current conversation
1. Open an AI chat app and load a conversation.
2. Click the extension icon.
3. Click **📋 Extract This Chat**.
4. View the preview and export in any format.

### Extract all chats from one platform
1. Open the AI platform (e.g. Gemini).
2. Click the extension icon.
3. Click **📚 All Chats (This Tab)**.
4. The extension runs in the background. You can close the popup.
5. Reopen the popup later to view progress and export results.

### Extract from every open AI tab
1. Open multiple AI chat apps in different tabs.
2. Click the extension icon.
3. Click **🌐 Extract ALL Open Tabs**.
4. Wait for the background batch to finish, then export.

### Dump DOMs for selector analysis
1. Open AI tabs with active conversations.
2. Click the extension icon.
3. Click **🔍 Dump DOMs of All Tabs**.
4. One JSON file per tab downloads to your Downloads folder.
5. Move the JSONs into `data/dom-dumps/` for analysis.

---

## 🔬 Selector discovery tools

### DOM-SCRAPER-UNIVERSAL.js
A universal console script. Paste it into DevTools Console on any AI chat page and it downloads a JSON DOM analysis, including detected selectors and actual extracted messages.

### PASTE-IN-CONSOLE.js
Legacy Gemini-specific console dump script.

### VERIFY-IN-CONSOLE.js
Run on an opened Gemini conversation to verify selectors.

### scrape-gemini-dom.js
Playwright headless scraper for DOM discovery.

---

## 🌿 Branch strategy

- `master` — clean, organized, stable-ish release code.
- `feature/improvements` — active development, experimental fixes, rapid iteration.

When a feature is proven stable on `feature/improvements`, it can be merged into `master`.

---

## ⚠️ Known issues

- "All chats" extraction is still being stabilized for platforms other than Gemini.
- Service-worker limitations require DOM dumps to use `Blob`/`URL.createObjectURL` instead of `FileReader`.
- Some platforms hide sidebar history until a menu is opened; auto-expansion is implemented but still being tuned.

---

## 🤝 Contributing data

If you want better extraction for a platform, run **🔍 Dump DOMs of All Tabs** and add the resulting JSON files to `data/dom-dumps/`. Exact selectors can then be added to `extension/content.js`.

---

## 📄 License

MIT — see LICENSE if included.
