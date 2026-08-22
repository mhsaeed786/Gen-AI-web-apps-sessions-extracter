# Extension Permissions

`extension/manifest.json` (MV3) — every permission and why it exists.

| Permission | Required for | Justification |
|---|---|---|
| `activeTab` | Popup "Extract This Chat" / "Live Capture" on the current tab | Grants temporary host access to the active tab when the user invokes the extension, allowing `chrome.scripting.executeScript` + `chrome.tabs.sendMessage` without broad host permissions on non-matched sites. User-gesture scoped; no standing access. |
| `tabs` | Discovering open AI chat tabs ("Extract All Tabs", batch mode) | `chrome.tabs.query({})` needs `tabs` to read `url`/`title` of other tabs. Used only against known AI-chat URL patterns; results are shown in the popup tab list. |
| `storage` | Batch state (`storage.session`), extraction history, settings | Durable/resumable batches live in `chrome.storage.session`; saved conversations in `chrome.storage.local`. No `unlimitedStorage` — history is capped at 100 entries. |
| `downloads` | Saving exports (TXT/MD/JSON/CSV) and DOM dumps | `chrome.downloads.download()` with data: URLs. `saveAs: true` for exports so the user picks the location; DOM dumps go straight to Downloads. |
| `scripting` | Injecting `content.js` on demand | `ensureCS()` re-injects the content script into AI tabs before messaging (handles SPA navigations and worker restarts). Only ever injects this extension's own file into matched AI sites or the activeTab target. |
| `contextMenus` | Right-click → "Extract AI Conversation" | One context-menu item restricted via `documentUrlPatterns` to the supported AI-chat domains. |
| `alarms` | Resumable background batches | MV3 service workers are terminated aggressively; a `batchTick` alarm (every 0.5 min) wakes the worker to process the next queued chat until the batch finishes, then the alarm is cleared. |

## Deliberately NOT requested

- **Host permissions** — not needed: content scripts are declared per-site in `content_scripts.matches`, and everything else runs through `activeTab`/explicit injection into those same matched tabs.
- `unlimitedStorage` — history is capped; session batch state fits the default quota.
- `cookies`, `webRequest`, `debugger`, `nativeMessaging` — no use case.
