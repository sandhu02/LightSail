# LightSail

A modular, privacy-conscious desktop browser built on Electron with vertical tabs, contextual page intelligence, and native LLM integration.

LightSail replaces traditional horizontal tab clutter with a collapsible vertical sidebar, while embedding a context-aware AI assistant capable of analyzing, summarizing, and querying the page currently in view. Under the hood, it leverages Electron's modern `WebContentsView` architecture for isolation, smooth resizing, and secure credential handling.

---

## Key Features

### Modern Vertical Tab Management
- **`WebContentsView` Engine**: Built on Electron's modern view API rather than legacy webviews or deprecated BrowserView implementations.
- **Dynamic View Resizing**: The tab viewport responds instantly to sidebar collapsing, resizing, and opening or closing side panels.
- **Internal Tab Deduplication**: Built-in views (Controls, Profile) automatically reuse existing open instances instead of creating duplicate tabs.
- **Tab Lifecycle**: Native event handling for favicons, titles, page navigation, history tracking, and back/forward state.

### Contextual "Ask AI" Assistant
- **In-Browser Side Panel**: Triggerable from the top toolbar, opening a dedicated side panel alongside the active webpage.
- **Page Context Extraction**: Safely extracts the current document title, URL, active text selection (up to 1,200 characters), and sanitized page content (up to 12,000 characters) to ground model answers in real-time context.
- **Multi-Provider Support**: Choose between Google Gemini, OpenAI, or a self-hosted custom chat endpoint.
- **Zero-Storage Keys in Renderer**: API keys are saved exclusively in the operating system's native credential store via `keytar` (Windows Credential Manager, macOS Keychain, or Linux Secret Service) and are never exposed to renderer scripts.

### Native Download Manager
- **Session Interception**: Hooks directly into Electron's `will-download` session handler.
- **Real-Time Transfer Metrics**: Tracks received bytes, total size, percentage progress, transfer status, and active download counts.
- **Transfer Controls**: Pause, resume, and cancel active downloads on demand.
- **Persistent Download History**: Automatically records completed downloads to `~/.lightSail/downloads.json` with one-click "Show in folder" actions.
- **Toolbar Indicator**: Shows a live progress indicator in the navigation bar whenever transfers are active.

### Internal Controls & Customization
- **Centralized Controls Screen**: Access browsing history, download transfers, wallpapers, startup modes, default search engines, bookmarks, and developer tools in a unified interface.
- **Home Screen & Wallpapers**: Clean new tab landing page with Google search and selectable background themes (Wheat, Jet, Bliss, or custom local image files).
- **Search Auto-Detection**: Omnibox search algorithm that detects full URLs, localhost/IP destinations, domain names, and fallback search queries.
- **Context Menus & DevTools**: Right-click context menus with navigation shortcuts, clipboard actions, and element inspection, plus toggles for internal debugging.

### Account & Profile Integration
- **OAuth Authentication**: Google OAuth flow integrated via a dedicated authentication window.
- **Local Profile Sync**: Persists user session details and profile metadata to personalize the browser experience.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |           Electron Main               |
                      |   (main.js, TabsManager, IPC, etc.)   |
                      +-------------------+-------------------+
                                          |
                   +----------------------+----------------------+
                   |                                             |
                   v                                             v
        +---------------------+                       +---------------------+
        |  Main Shell Window  |                       |  WebContentsView    |
        |  (Sidebar, Toolbar, |                       |  Tab Views          |
        |   Ask AI Panel)     |                       |  (Web Content &     |
        |                     |                       |   Internal Screens) |
        |  Preload:           |                       |  Preload:           |
        |  preload.js         |                       |  viewPreload.js     |
        +----------+----------+                       +----------+----------+
                   |                                             |
                   | IPC (tab, layout, ai, auth)                 | Restricted IPC
                   +----------------------+----------------------+
                                          |
                      +-------------------+-------------------+
                      |             AI Subsystem              |
                      |  - AISettingsService (keytar)         |
                      |  - LLM Gateway (Gemini / OpenAI)      |
                      |  - Custom Chat Provider (REST API)    |
                      +---------------------------------------+
```

### Security & Process Isolation
1. **Context Isolation**: Enabled on all windows and web views with `nodeIntegration: false`.
2. **Preload Separation**: The shell window uses `preload.js` with access to window layout controls and AI interaction, while browsing tabs execute behind `viewPreload.js`.
3. **Internal Origin Guards**: Sensitive APIs (accessing saved AI settings, clearing histories, or querying native download states) verify that callers are internal `file://` resources before executing. External web content loaded in a tab has no access to sensitive IPC bridges.
4. **OS-Level Credential Protection**: API keys are securely persisted in system keychains using `keytar` rather than plaintext configuration files or web storage.

---

## Project Structure

```
lightSail/
├── assets/
│   ├── icons/             # SVGs for toolbar, navigation, and sidebar
│   └── images/            # Default wallpapers, logos, and avatars
├── src/
│   ├── ai/                # High-level AI architecture and orchestration specs
│   ├── config/            # Network endpoints and service ports (url.js)
│   ├── main/              # Electron main process
│   │   ├── ai/            # Gateways, secret storage (keytar), and LLM providers
│   │   ├── menus/         # Native application and context menus
│   │   ├── DownloadManager.js # Download listener and history persistence
│   │   ├── TabsManager.js     # WebContentsView lifecycle and geometry manager
│   │   ├── ipcHandlers.js     # Inter-process communication registry
│   │   └── main.js            # Application entrypoint
│   ├── preload/
│   │   ├── preload.js     # Bridge for main browser shell
│   │   └── viewPreload.js # Bridge for tab WebContentsViews
│   ├── renderer/          # User interface
│   │   ├── components/    # HomeScreen, ControlsScreen, ProfileScreen
│   │   ├── scripts/       # UI controllers, settings managers, and renderers
│   │   ├── styles/        # CSS stylesheets for core UI and internal screens
│   │   └── index.html     # Main browser window shell
│   └── utils/             # URL parsing, timestamp formatting, internal page guards
├── architecture.md        # Comprehensive system architectural blueprint
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Platform Build Tools** (required to compile native modules like `keytar`):
  - **Windows**: Visual Studio C++ Build Tools or Windows SDK (automatically available via standard Visual Studio installation).
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
  - **Linux**: `libsecret-1-dev`, `python3`, and standard build essentials (`build-essential`).

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sandhu02/LightSail.git
   cd LightSail
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application in development mode**:
   ```bash
   npm start
   ```

---

## Configuring AI Providers

LightSail comes configured to work with either external model APIs or your own custom chat server.

1. Launch LightSail and open **Controls** by clicking the sliders icon in the bottom-left corner of the sidebar (or navigate to `Controls`).
2. Select **AI Settings** from the navigation menu.
3. Choose your provider:
   - **Gemini**: Supported models include `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, and `gemini-1.5-flash`.
   - **OpenAI**: Supported models include `gpt-4.1-mini`, `gpt-4.1`, `gpt-4o-mini`, and `gpt-4o`.
   - **Custom**: Connects to the HTTP query endpoint defined in `src/config/url.js`.
4. Paste your API key and click **Save**. The key is stored in your OS keychain via `keytar` and is immediately active for in-page queries through the **Ask AI** panel.

To modify network endpoints for custom authentication or chat services, edit `src/config/url.js`:
```javascript
BASE_URL = 'http://localhost' // or your backend server host
AUTH_PORT = 8080
CHAT_PORT = 8000
```

---

## Development & Roadmap

LightSail is structured in incremental phases:

- [x] **Phase 1: Core Browser & UI Foundation**
  - Modern `WebContentsView` tab controller.
  - Collapsible vertical navigation sidebar.
  - Smart address bar with input classification.
  - Native download manager with status tracking and history.
  - Controls dashboard for appearance, history, and search engine selection.
  - Ask AI panel with DOM context gathering and multi-model gateway.
  - Secure credential storage using `keytar`.
- [ ] **Phase 2: Browser Automation & Tool Execution**
  - Playwright / Selenium driver integration inside `src/automation`.
  - Automated action playback and web scraping pipeline.
- [ ] **Phase 3: Agentic Intelligence & MCP**
  - Model Context Protocol (MCP) server and client integration (`src/mcp`).
  - Tool execution registry for filesystem, tabs, and automation tasks.
  - Retrieval-Augmented Generation (RAG) vector memory across visited pages (`src/rag`).

---

## Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add descriptive commit message"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a Pull Request explaining the problem solved and changes introduced.

---

## License

This project is licensed under the ISC License.
