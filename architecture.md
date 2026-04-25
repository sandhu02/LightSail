lightSail-browser/
│
├── package.json
├── electron-builder.json
├── .env
│
├── /src
│   │
│   ├── /main                # Electron main process
│   │   ├── main.js
│   │   ├── windowManager.js
│   │   ├── browserViewManager.js
│   │   └── ipcHandlers.js
│   │
│   ├── /preload             # Secure bridge
│   │   └── preload.js
│   │
│   ├── /renderer            # UI (frontend)
│   │   ├── index.html
│   │   ├── /components
│   │   │   ├── Toolbar.js
│   │   │   ├── Tabs.js
│   │   │   └── AddressBar.js
│   │   ├── /styles
│   │   └── renderer.js
│   │
│   ├── /core                # App brain (VERY IMPORTANT)
│   │   ├── controller.js
│   │   ├── commandBus.js
│   │   ├── stateManager.js
│   │   └── eventBus.js
│   │
│   ├── /automation          # Automation engines
│   │   ├── selenium/
│   │   │   ├── seleniumService.js
│   │   │   └── driverManager.js
│   │   │
│   │   ├── playwright/
│   │   │   └── playwrightService.js
│   │   │
│   │   └── automationManager.js
│   │
│   ├── /ai                  # LLM integration
│   │   ├── geminiClient.js
│   │   ├── promptBuilder.js
│   │   ├── actionParser.js
│   │   └── aiOrchestrator.js
│   │
│   ├── /mcp                 # MCP servers/tools
│   │   ├── mcpClient.js
│   │   ├── toolRegistry.js
│   │   └── toolExecutor.js
│   │
│   ├── /services            # Shared services
│   │   ├── navigationService.js
│   │   ├── domService.js
│   │   ├── storageService.js
│   │   └── logger.js
│   │
│   ├── /utils
│   │   ├── helpers.js
│   │   └── constants.js
│   │
│   └── /config
│       ├── config.js
│       └── env.js
│
└── /scripts                 # build/dev scripts
    └── start.js