# LightSail — AI-Powered Browser

## Project Overview

LightSail is an **Electron-based AI browser** built as a Final Year Project (FYP). It wraps a multi-tab Chromium browser with AI-powered features: Ask AI (page Q&A), Auto Navigate (autonomous agent), and Voice Input (speech-to-text via Gemini).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 41 (Chromium + Node.js) |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Fonts | DM Sans (Google Fonts) |
| State | electron-store (settings), keytar (API keys) |
| AI Providers | Gemini (default), OpenAI, Custom |
| Voice STT | Gemini 1.5 Flash multimodal (audio → text) |

---

## Project Structure

```
lightSail/
├── src/
│   ├── main/                      # Node.js main process
│   │   ├── main.js                # Entry: creates BrowserWindow, grants mic permission
│   │   ├── ipcHandlers.js         # All IPC channel registrations
│   │   ├── TabsManager.js         # Multi-tab BrowserView management
│   │   ├── DownloadManager.js     # File download tracking
│   │   ├── menus/applicationMenu.js
│   │   └── ai/
│   │       ├── settings/
│   │       │   ├── aiCatalog.js        # Provider definitions + model lists
│   │       │   ├── aiSettingsStore.js  # electron-store wrapper
│   │       │   ├── aiSecretsStore.js   # keytar wrapper for API keys
│   │       │   └── aiSettingsService.js
│   │       ├── providers/
│   │       │   ├── geminiProvider.js   # Gemini generateContent + tools
│   │       │   ├── openaiProvider.js   # OpenAI chat completions + tools
│   │       │   └── customChatProvider.js
│   │       └── features/
│   │           ├── ask_ai/             # Page Q&A feature
│   │           └── auto_nav/           # Autonomous navigation agent
│   ├── preload/
│   │   ├── preload.js             # contextBridge: tabs, ai, auth, agent, electronAPI
│   │   └── viewPreload.js         # Injected into BrowserView tabs
│   ├── renderer/                  # UI (Chromium renderer process)
│   │   ├── index.html             # Main shell: sidebar, toolbar, panels
│   │   ├── components/
│   │   │   ├── HomeScreen.html    # New-tab page: Google search + wallpaper
│   │   │   ├── ControlsScreen.html
│   │   │   └── ProfileScreen.html
│   │   ├── scripts/
│   │   │   ├── index.js           # Main UI logic: tabs, panels, toolbar, voice wiring
│   │   │   ├── homeScreen.js      # Home tab: search, wallpaper, voice wiring
│   │   │   ├── voiceInput.js      # Reusable VoiceInputManager (MediaRecorder → Gemini)
│   │   │   └── profileScreen.js
│   │   ├── styles/
│   │   │   ├── main.css           # Global design system (glassmorphism dark theme)
│   │   │   ├── home.css           # Home screen styles
│   │   │   ├── auto_nav.css       # Agent panel styles
│   │   │   ├── controls.css
│   │   │   └── profile.css
│   │   └── ai/features/
│   │       ├── ask_ai/askAiClient.js
│   │       └── auto_nav/autoNavClient.js
│   └── config/url.js              # AUTH_URL and other constants
├── assets/images/                 # Wallpapers, logo
├── package.json
└── CLAUDE.md
```

---

## IPC Channels

All IPC is registered in `src/main/ipcHandlers.js` and bridged through `src/preload/preload.js`.

### `window.tabs`
| Channel | Type | Description |
|---|---|---|
| `tab:create` | send | Create new tab (optional URL) |
| `tab:close` | send | Close tab by ID |
| `tab:switch` | send | Switch active tab |
| `tab:navigate` | send | Navigate tab to URL |
| `tab:back/forward/reload` | send | Navigation controls |
| `layout:update` | send | Push sidebar/toolbar dimensions to BrowserView |
| `tab:created/closed/switched/title/favicon/url` | on | Tab state change events |

### `window.ai`
| Channel | Type | Description |
|---|---|---|
| `ai:ask` | invoke | Ask AI about current page |
| `ai:settings:get` | invoke | Get provider/model/key status |
| `ai:settings:update` | invoke | Change provider or model |
| `ai:key:set` | invoke | Store API key via keytar |
| `ai:key:clear` | invoke | Remove stored API key |

### `window.agent`
| Channel | Type | Description |
|---|---|---|
| `agent:start` | invoke | Start autonomous navigation with a prompt |
| `agent:stop` | send | Stop running agent |
| `agent:step` | on | Stream agent step updates |
| `agent:status` | on | Stream status (idle/running/done) |

### `window.electronAPI`
| Channel | Type | Description |
|---|---|---|
| `voice:transcribe` | invoke | Send audio bytes → Gemini 1.5 Flash → transcript |
| `download:indicator` | on | Show/hide download progress ring |

### `window.auth`
| Channel | Type | Description |
|---|---|---|
| `auth:start` | send | Open OAuth popup window |
| `auth:success` / `auth:error` | on | Auth result callbacks |

---

## AI Provider System

Providers configured in `src/main/ai/settings/aiCatalog.js`.

**Default provider:** `gemini` (`gemini-2.5-flash`)

**To add a new provider:**
1. Add entry to `AI_PROVIDER_CATALOG` in `aiCatalog.js`
2. Create `src/main/ai/providers/<name>Provider.js`
3. Wire into `ask_ai` and/or `auto_nav` services

**API keys** are stored securely via **keytar** (OS keychain). Never store keys in `electron-store` or plain files.

---

## Voice Input System

**File:** `src/renderer/scripts/voiceInput.js`

**Architecture:**
```
Mic → MediaRecorder (local webm/opus) → IPC voice:transcribe → Gemini 1.5 Flash → text → input field
```

### Why not Web Speech API?
`webkitSpeechRecognition` in Electron streams audio to Google's cloud via a chunked HTTP upload. This fails in Electron's network sandbox (`ERR_FAILED / -2`). `MediaRecorder` captures audio locally and sends bytes over IPC instead.

### Reusable singleton API
```js
// Works on any page that loads voiceInput.js:
window.voiceInputManager.start(inputOrTextareaElement)
window.voiceInputManager.start(el, { append: true })  // append mode
window.voiceInputManager.stop()
```

### Where it's wired
| Page/Panel | Button | Target field |
|---|---|---|
| Home Screen | `.voice-btn` | `#google-search` |
| Ask AI panel | `#ask-ai-voice-btn` | `#ask-ai-input` |
| Auto Navigate panel | `#agent-voice-btn` | `#agent-input` |

> **Note:** `HomeScreen.html` is a separate document loaded in a BrowserView. `voiceInput.js` must be included explicitly in it — it is not inherited from `index.html`.

### Requirements
- **Gemini API key** set in Controls → AI Settings
- Gemini free tier: 1,500 requests/day (plenty for voice use)

---

## Design System

**Theme:** Glassmorphism dark (deep navy/black, `#4f9eff` blue accent)

**CSS variables** (all in `main.css` `:root`):
```css
--sidebar-width: 220px;
--accent: #4f9eff;
--accent-glow: rgba(79, 158, 255, 0.35);
--text-primary: rgba(255, 255, 255, 0.92);
--text-secondary: rgba(255, 255, 255, 0.50);
--text-muted: rgba(255, 255, 255, 0.30);
--glass-bg: rgba(255, 255, 255, 0.06);
--glass-border: rgba(255, 255, 255, 0.12);
--glass-hover: rgba(255, 255, 255, 0.10);
--transition: 0.32s cubic-bezier(0.4, 0, 0.2, 1);
```

**Layout state classes on `#app`:**
- `ask-ai-open` — slides in Ask AI panel (right), shifts main content
- `agent-open` — expands Auto Navigate panel (bottom)

---

## Running the App

```bash
npm start    # Launches Electron (no build step needed)
```

Electron loads files directly from `src/` — no bundler/transpiler required.

---

## Conventions

### Main process
- **CommonJS only** — `require()` not `import` (`"type": "commonjs"` in package.json)
- All IPC registrations go in `ipcHandlers.js`
- AI business logic lives in `ai/providers/` and `ai/features/`
- Never expose Node.js APIs to renderer directly — always use `contextBridge`

### Renderer process
- Plain vanilla JS — no framework, no bundler
- Scripts loaded via `<script src="...">` in HTML files
- Use only bridged APIs: `window.tabs`, `window.ai`, `window.agent`, `window.electronAPI`
- `window.voiceInputManager` — shared singleton, loaded explicitly per page

### CSS
- Global styles in `main.css`; page-specific in separate CSS files
- Always use CSS variables for colours — never hardcode hex values inline
- Glassmorphism: `backdrop-filter: blur()` + semi-transparent backgrounds

### Security
- `contextIsolation: true`, `nodeIntegration: false` (enforced in `main.js`)
- API keys in OS keychain (keytar) only — never in localStorage or electron-store
- No sensitive data passed as IPC payloads beyond what's needed per request

---

## Common Gotchas

1. **Mic permission** — `session.defaultSession.setPermissionRequestHandler` must be called in `main.js` to allow `media`/`microphone`. Without it `getUserMedia` is silently denied.

2. **Web Speech API is broken in Electron** — Do not use `SpeechRecognition`/`webkitSpeechRecognition`. Use `MediaRecorder` + `voice:transcribe` IPC → Gemini.

3. **BrowserView layout sync** — Call `window.tabs.updateLayout(bounds)` whenever sidebar width or panel visibility changes. `sendLayoutBounds()` in `index.js` centralises this.

4. **HomeScreen is isolated** — It loads as a separate HTML document in a BrowserView. Any shared script (e.g. `voiceInput.js`) must be explicitly included in `HomeScreen.html` via its own `<script>` tag.

5. **IPC invoke vs send** — `ipcRenderer.invoke` returns a Promise (use for operations needing a response). `ipcRenderer.send` is fire-and-forget.

6. **Gemini model naming** — The Gemini provider normalises model IDs: `gemini-2.5-flash` is passed as-is; bare names like `2.5-flash` are prefixed with `gemini-` automatically.

