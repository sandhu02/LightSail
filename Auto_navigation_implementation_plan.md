# Auto-Navigation Agent — Implementation Plan

> **Goal**: Allow the user to type a natural-language prompt (e.g. *"Find the cheapest flight from Lahore to London on Google Flights"*) and have the browser **autonomously navigate, interact with page elements, and complete the task** — all visible in real-time inside the active tab.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Codebase Integration Map](#2-codebase-integration-map)
3. [Phase 1 — DOM Inspection Engine](#3-phase-1--dom-inspection-engine)
4. [Phase 2 — Agent Orchestrator (Main Process)](#4-phase-2--agent-orchestrator-main-process)
5. [Phase 3 — Tool Definitions & Action Executor](#5-phase-3--tool-definitions--action-executor)
6. [Phase 4 — IPC Contracts & Preload Bridge](#6-phase-4--ipc-contracts--preload-bridge)
7. [Phase 5 — Renderer UI (Agent Panel)](#7-phase-5--renderer-ui-agent-panel)
8. [Phase 6 — Agentic Loop & Convergence Logic](#8-phase-6--agentic-loop--convergence-logic)
9. [Phase 7 — Safety, Guardrails & Error Handling](#9-phase-7--safety-guardrails--error-handling)
10. [Phase 8 — Polish, Testing & Edge Cases](#10-phase-8--polish-testing--edge-cases)
11. [New Dependencies](#11-new-dependencies)
12. [Complete File Manifest](#12-complete-file-manifest)

---

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         RENDERER  (index.html)                           │
│                                                                          │
│  ┌──────────────┐   ┌──────────────────────────────────────────────────┐  │
│  │  Agent Panel  │   │  Active WebContentsView (the browsed page)      │  │
│  │              │   │                                                  │  │
│  │ • prompt bar │   │  ┌──────────────────────────────────────────┐   │  │
│  │ • step log   │   │  │  viewPreload.js                          │   │  │
│  │ • status     │   │  │  ↕ DOM Snapshot script (executeJS)       │   │  │
│  │ • stop btn   │   │  └──────────────────────────────────────────┘   │  │
│  └──────┬───────┘   └────────────────────┬─────────────────────────────┘  │
│         │ IPC                            │ executeJavaScript               │
│         ▼                                ▼                                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     MAIN PROCESS                                    │  │
│  │                                                                     │  │
│  │  ┌──────────────────┐   ┌─────────────────┐  ┌──────────────────┐  │  │
│  │  │ AutoNavService    │──▶│ AgentOrchestrator│──▶│ ActionExecutor  │  │  │
│  │  │ (IPC entry point) │   │ (agentic loop)   │  │ (runs actions   │  │  │
│  │  └──────────────────┘   │                   │  │  on webContents) │  │  │
│  │                          │  ┌─────────────┐ │  └──────────────────┘  │  │
│  │                          │  │ LLM Gateway  │ │                       │  │
│  │                          │  │ (Gemini /    │ │                       │  │
│  │                          │  │  OpenAI)     │ │                       │  │
│  │                          │  └─────────────┘ │                       │  │
│  │                          │  ┌─────────────┐ │                       │  │
│  │                          │  │ ToolRegistry │ │                       │  │
│  │                          │  │ (tool defs)  │ │                       │  │
│  │                          │  └─────────────┘ │                       │  │
│  │                          └─────────────────┘                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Core Idea

The agent follows a **ReAct-style agentic loop**:

1. **Observe** → Take a DOM snapshot of the current page (interactive elements, text, URL)
2. **Think** → Send the snapshot + user goal + action history to the LLM
3. **Act** → LLM responds with a structured tool call (click, type, navigate, scroll, wait, done)
4. **Repeat** until the LLM emits the `done` tool or the max-step limit is reached

All actions execute via `webContents.executeJavaScript()` on the active tab's `WebContentsView` — no external browser automation library (Playwright/Selenium) is needed for this phase. The user watches the browser navigate in real-time.

---

## 2. Codebase Integration Map

This section maps every new module to the existing project structure and identifies which existing files need modification.

### New Files to Create

| Path | Purpose |
|------|---------|
| `src/main/ai/features/auto_nav/autoNavService.js` | Main process service — receives IPC calls, owns the agent lifecycle |
| `src/main/ai/features/auto_nav/agentOrchestrator.js` | Agentic loop (observe → think → act → repeat) |
| `src/main/ai/features/auto_nav/domSnapshotBuilder.js` | Builds a structured text snapshot of the active page DOM |
| `src/main/ai/features/auto_nav/actionExecutor.js` | Translates LLM tool calls into `executeJavaScript()` commands |
| `src/main/ai/features/auto_nav/toolDefinitions.js` | Declares the tool/function schemas sent to the LLM |
| `src/main/ai/features/auto_nav/promptTemplates.js` | System prompt and user prompt templates for the agent |
| `src/main/ai/features/auto_nav/autoNavTypes.js` | JSDoc typedefs and constants (step limits, status enums) |
| `src/renderer/ai/features/auto_nav/autoNavClient.js` | Renderer-side client that wires the Agent Panel UI to IPC |
| `src/renderer/styles/auto_nav.css` | Styles for the Agent Panel UI |

### Existing Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipcHandlers.js` | Register new `agent:*` IPC channels |
| `src/preload/preload.js` | Expose `window.agent` bridge to renderer |
| `src/renderer/index.html` | Add Agent Panel HTML markup + script/CSS imports |
| `src/renderer/scripts/index.js` | Add Agent Panel open/close toggle logic + layout bounds |
| `src/renderer/styles/main.css` | Add Agent Panel layout integration (similar to Ask AI panel) |
| `src/main/ai/providers/geminiProvider.js` | Add function-calling / tool-use support to Gemini requests |
| `src/main/ai/providers/openaiProvider.js` | Add function-calling / tool-use support to OpenAI requests |
| `src/main/ai/core/llmGateway.js` | Add a new `generateWithTools()` function for tool-augmented calls |

---

## 3. Phase 1 — DOM Inspection Engine

### Purpose

Build a JavaScript snippet that runs inside the active tab's `WebContentsView` via `webContents.executeJavaScript()`. It extracts all interactive elements on the page and returns a structured, compact text representation that the LLM can reason over.

### File: `src/main/ai/features/auto_nav/domSnapshotBuilder.js`

### Function Signature

```js
/**
 * Executes JS in the target webContents and returns a structured DOM snapshot.
 *
 * @param {Electron.WebContents} webContents - The active tab's webContents
 * @returns {Promise<DOMSnapshot>}
 */
async function buildDOMSnapshot(webContents) → Promise<DOMSnapshot>
```

### Output Schema: `DOMSnapshot`

```js
/**
 * @typedef {Object} DOMSnapshot
 * @property {string} url             - Current page URL (window.location.href)
 * @property {string} title           - Current page title (document.title)
 * @property {InteractiveElement[]} elements - All interactive elements on the page
 * @property {string} pageText        - Visible body text, truncated to 8000 chars
 * @property {Object} scrollInfo      - Scroll position and page dimensions
 * @property {number} scrollInfo.scrollX      - Current horizontal scroll
 * @property {number} scrollInfo.scrollY      - Current vertical scroll
 * @property {number} scrollInfo.scrollHeight - Total scrollable height
 * @property {number} scrollInfo.viewportHeight - Visible viewport height
 * @property {number} scrollInfo.viewportWidth  - Visible viewport width
 */
```

### Element Schema: `InteractiveElement`

```js
/**
 * @typedef {Object} InteractiveElement
 * @property {number}  index       - Unique sequential index (0, 1, 2, ...)
 *                                   used by the LLM to reference this element
 * @property {string}  tag         - HTML tag name (lowercase): 'a', 'button', 'input', etc.
 * @property {string}  role        - ARIA role if present, else empty string
 * @property {string}  text        - Visible inner text, trimmed and truncated to 80 chars
 * @property {string}  placeholder - Placeholder attribute value (for inputs), else ''
 * @property {string}  value       - Current value (for inputs/selects), else ''
 * @property {string}  href        - href attribute (for links), else ''
 * @property {string}  type        - type attribute (for inputs: 'text', 'password', 'submit'), else ''
 * @property {string}  ariaLabel   - aria-label attribute, else ''
 * @property {boolean} disabled    - Whether the element is disabled
 * @property {boolean} visible     - Whether the element is within the viewport and visible
 * @property {Object}  rect        - Bounding rectangle {x, y, width, height}
 */
```

### How It Works

1. The function constructs a **self-contained JavaScript string** (IIFE) that:
   - Queries all elements matching the selector: `a, button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="option"], [contenteditable="true"]`
   - Filters out elements that are hidden (`display: none`, `visibility: hidden`, zero dimensions)
   - Assigns each visible element a sequential `index` (0, 1, 2, ...)
   - Injects a small colored badge overlay (`<div data-autonav-marker>`) onto each indexed element showing its index number — this is purely visual so the user can see what the agent is "looking at"
   - Collects `pageText` from `document.body.innerText` truncated to 8,000 characters
   - Collects scroll information
   - Returns the full `DOMSnapshot` object

2. The function calls `webContents.executeJavaScript(snippet)` and returns the parsed result.

### Text Representation Sent to LLM

The snapshot is converted to a compact text format before being included in the LLM prompt:

```
Page: "Google Flights" | URL: https://www.google.com/travel/flights
Scroll: 0/2400 (viewport 900px)

Interactive elements:
[0] <input> type="text" placeholder="Where from?" value="Lahore"
[1] <input> type="text" placeholder="Where to?" value=""
[2] <button> "Search"
[3] <a> "Explore" href="/travel/explore"
[4] <select> value="1 passenger"
[5] <button> "Round trip"
...

Visible text (first 4000 chars):
Google Flights — Find cheap flights & compare prices...
```

### Function: `snapshotToText(snapshot: DOMSnapshot) → string`

Converts the `DOMSnapshot` object into the compact text format shown above. This is what gets embedded into the LLM user prompt.

---

## 4. Phase 2 — Agent Orchestrator (Main Process)

### Purpose

The orchestrator manages the **agentic loop**: observe → think → act → repeat. It maintains the conversation history, enforces step limits, and communicates progress back to the renderer.

### File: `src/main/ai/features/auto_nav/agentOrchestrator.js`

### Class: `AgentOrchestrator`

```js
class AgentOrchestrator {
  /**
   * @param {Object} deps
   * @param {TabManager}        deps.tabs              - TabManager instance
   * @param {AISettingsService} deps.aiSettingsService  - For retrieving provider/key
   * @param {Function}          deps.onStepUpdate      - Callback to send step updates to renderer
   * @param {Function}          deps.onStatusChange    - Callback to send status changes to renderer
   */
  constructor({ tabs, aiSettingsService, onStepUpdate, onStatusChange })
}
```

### Method: `run(prompt)`

```js
/**
 * Starts the agentic auto-navigation loop.
 *
 * @param {string} prompt - The user's natural-language goal
 * @returns {Promise<AgentResult>}
 */
async run(prompt) → Promise<AgentResult>
```

### Internal Loop Logic (Pseudocode)

```
1.  status ← 'running'
2.  stepCount ← 0
3.  conversationHistory ← [ systemPrompt ]
4.  
5.  WHILE status === 'running' AND stepCount < MAX_STEPS (15):
6.      a. snapshot ← buildDOMSnapshot(activeWebContents)
7.      b. snapshotText ← snapshotToText(snapshot)
8.      c. Append user message to conversationHistory:
9.            "Step {stepCount}. Current page state:\n{snapshotText}"
10.     d. llmResponse ← generateWithTools(conversationHistory, toolDefinitions, settings)
11.     e. IF llmResponse contains a tool_call:
12.         i.   Parse the tool call → { toolName, toolArgs }
13.         ii.  Emit onStepUpdate({ step: stepCount, tool: toolName, args: toolArgs, status: 'executing' })
14.         iii. result ← actionExecutor.execute(webContents, toolName, toolArgs)
15.         iv.  Append assistant message (tool call) to conversationHistory
16.         v.   Append tool result message to conversationHistory
17.         vi.  Emit onStepUpdate({ step: stepCount, tool: toolName, args: toolArgs, result, status: 'done' })
18.         vii. IF toolName === 'done':
19.                status ← 'completed'
20.         viii. ELSE:
21.                await wait(1500ms) — allow page to load/react
22.     f. ELSE IF llmResponse is plain text (no tool call):
23.         i.  Emit onStepUpdate({ step: stepCount, message: llmResponse.text, status: 'thinking' })
24.         ii. Append assistant message to conversationHistory
25.     g. stepCount++
26.
27.  IF stepCount >= MAX_STEPS:
28.      status ← 'max_steps_reached'
29.
30.  Emit onStatusChange(status)
31.  Return { status, totalSteps: stepCount, finalUrl, finalTitle }
```

### Schemas

#### `AgentResult`

```js
/**
 * @typedef {Object} AgentResult
 * @property {'completed' | 'max_steps_reached' | 'stopped' | 'error'} status
 * @property {number}  totalSteps  - How many loop iterations ran
 * @property {string}  finalUrl    - URL of the page when the agent stopped
 * @property {string}  finalTitle  - Title of the page when the agent stopped
 * @property {string}  [summary]   - The LLM's final summary (from 'done' tool)
 * @property {string}  [error]     - Error message if status is 'error'
 */
```

#### `StepUpdate` (sent via IPC to renderer)

```js
/**
 * @typedef {Object} StepUpdate
 * @property {number}  step                - Current step number (0-indexed)
 * @property {string}  [tool]              - Tool name that was called
 * @property {Object}  [args]              - Arguments passed to the tool
 * @property {string}  [result]            - Result/outcome of the tool execution
 * @property {string}  [message]           - Plain text thinking from the LLM
 * @property {'executing' | 'done' | 'thinking' | 'error'} status
 * @property {number}  timestamp           - Date.now()
 */
```

#### `StatusChange` (sent via IPC to renderer)

```js
/**
 * @typedef {Object} StatusChange
 * @property {'idle' | 'running' | 'completed' | 'stopped' | 'max_steps_reached' | 'error'} status
 * @property {string}  [summary]
 * @property {string}  [error]
 */
```

### Abort / Stop Mechanism

The orchestrator exposes a `stop()` method:

```js
/**
 * Gracefully stops the running agent loop.
 * Sets an internal `aborted` flag checked at the top of each iteration.
 */
stop()
```

When `stop()` is called, the loop breaks at the next iteration boundary, emits `status: 'stopped'`, and returns.

---

## 5. Phase 3 — Tool Definitions & Action Executor

### 5A. Tool Definitions

### File: `src/main/ai/features/auto_nav/toolDefinitions.js`

These are the function/tool schemas sent to the LLM so it knows what actions it can perform. The format follows the **OpenAI function calling schema** (which Gemini also supports via equivalent mapping).

```js
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "click",
      description: "Click on an interactive element identified by its index number from the DOM snapshot.",
      parameters: {
        type: "object",
        properties: {
          index: {
            type: "number",
            description: "The index number of the element to click (from the interactive elements list)."
          }
        },
        required: ["index"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Clear an input/textarea element and type new text into it. Use this for search boxes, form fields, etc.",
      parameters: {
        type: "object",
        properties: {
          index: {
            type: "number",
            description: "The index number of the input element to type into."
          },
          text: {
            type: "string",
            description: "The text to type into the element."
          },
          pressEnter: {
            type: "boolean",
            description: "Whether to press Enter after typing. Default false."
          }
        },
        required: ["index", "text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate the browser to a specific URL. Use this when you need to go to a known URL directly.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL to navigate to (must start with http:// or https://)."
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "scroll",
      description: "Scroll the page up or down to reveal more content.",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["up", "down"],
            description: "Direction to scroll."
          },
          amount: {
            type: "number",
            description: "Pixels to scroll. Default is 500."
          }
        },
        required: ["direction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "wait",
      description: "Wait for the page to load or for dynamic content to appear. Use after navigation or clicking elements that trigger page loads.",
      parameters: {
        type: "object",
        properties: {
          milliseconds: {
            type: "number",
            description: "Time to wait in milliseconds (100-5000). Default is 2000."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "select_option",
      description: "Select an option from a <select> dropdown element.",
      parameters: {
        type: "object",
        properties: {
          index: {
            type: "number",
            description: "The index number of the <select> element."
          },
          value: {
            type: "string",
            description: "The value or visible text of the option to select."
          }
        },
        required: ["index", "value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "go_back",
      description: "Navigate back to the previous page (browser back button).",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "done",
      description: "Signal that the task is complete. Call this when the user's goal has been fulfilled or when you determine the goal cannot be accomplished.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "A brief summary of what was accomplished or why the task could not be completed."
          },
          success: {
            type: "boolean",
            description: "Whether the task was successfully completed."
          }
        },
        required: ["summary", "success"]
      }
    }
  }
]
```

### 5B. Action Executor

### File: `src/main/ai/features/auto_nav/actionExecutor.js`

The `ActionExecutor` takes a parsed tool call and translates it into `webContents.executeJavaScript()` calls.

### Class: `ActionExecutor`

```js
class ActionExecutor {
  /**
   * @param {Electron.WebContents} webContents - The active tab's webContents
   */
  constructor(webContents)
}
```

### Method: `execute(toolName, toolArgs)`

```js
/**
 * Executes a single tool call on the page.
 *
 * @param {string} toolName - One of: 'click', 'type_text', 'navigate', 'scroll',
 *                            'wait', 'select_option', 'go_back', 'done'
 * @param {Object} toolArgs - Arguments for the tool (schema varies by tool)
 * @returns {Promise<ActionResult>}
 */
async execute(toolName, toolArgs) → Promise<ActionResult>
```

### Output Schema: `ActionResult`

```js
/**
 * @typedef {Object} ActionResult
 * @property {boolean} success    - Whether the action executed without error
 * @property {string}  message    - Human-readable description of what happened
 * @property {string}  [error]    - Error message if success is false
 * @property {Object}  [data]     - Any additional data (e.g., new URL after navigate)
 */
```

### Action Implementations

Each action generates a JavaScript snippet to run in the page context:

#### `click(index)`
```
Input:  { index: 2 }
Script: Finds the element with data-autonav-index="2", calls element.click()
Output: { success: true, message: "Clicked button 'Search'" }
```

#### `type_text(index, text, pressEnter?)`
```
Input:  { index: 1, text: "London", pressEnter: false }
Script: Finds element[data-autonav-index="1"], sets focus, clears existing value,
        dispatches 'input' and 'change' events with the new text.
        If pressEnter is true, dispatches a KeyboardEvent('keydown', {key: 'Enter'}).
Output: { success: true, message: "Typed 'London' into input[placeholder='Where to?']" }
```

#### `navigate(url)`
```
Input:  { url: "https://www.google.com/flights" }
Script: Calls webContents.loadURL(url) directly (not executeJavaScript)
        Then waits for 'did-finish-load' event before returning.
Output: { success: true, message: "Navigated to https://www.google.com/flights" }
```

#### `scroll(direction, amount?)`
```
Input:  { direction: "down", amount: 500 }
Script: window.scrollBy(0, 500) or window.scrollBy(0, -500) for 'up'
Output: { success: true, message: "Scrolled down 500px" }
```

#### `wait(milliseconds?)`
```
Input:  { milliseconds: 2000 }
Script: Simple setTimeout/delay in the main process
Output: { success: true, message: "Waited 2000ms" }
```

#### `select_option(index, value)`
```
Input:  { index: 4, value: "2 passengers" }
Script: Finds select element, sets .value to matching option, dispatches 'change' event
Output: { success: true, message: "Selected '2 passengers' in dropdown" }
```

#### `go_back()`
```
Input:  {}
Script: Calls webContents.goBack() directly
Output: { success: true, message: "Navigated back" }
```

#### `done(summary, success)`
```
Input:  { summary: "Found cheapest flight: $450 PIA", success: true }
Script: No page action. Returns the summary to end the loop.
Output: { success: true, message: "Task complete: Found cheapest flight: $450 PIA" }
```

### Element Targeting Strategy

During the DOM snapshot phase (Phase 1), each interactive element gets a `data-autonav-index` attribute injected. The action executor uses this attribute to find elements:

```js
// Injected during snapshot:
element.setAttribute('data-autonav-index', String(index))

// Used during action execution:
const el = document.querySelector(`[data-autonav-index="${index}"]`)
```

This is more reliable than CSS selectors or XPath because:
- The indices are assigned fresh each snapshot cycle
- They survive DOM mutations between snapshot and action
- The LLM only needs to reference simple numbers

---

## 6. Phase 4 — IPC Contracts & Preload Bridge

### 6A. New IPC Channels

Register these in `src/main/ipcHandlers.js`:

| Channel | Direction | Type | Payload | Response |
|---------|-----------|------|---------|----------|
| `agent:start` | Renderer → Main | `ipcMain.handle` | `{ prompt: string }` | `Promise<AgentResult>` |
| `agent:stop` | Renderer → Main | `ipcMain.on` | *(none)* | *(none)* |
| `agent:step` | Main → Renderer | `win.webContents.send` | `StepUpdate` | — |
| `agent:status` | Main → Renderer | `win.webContents.send` | `StatusChange` | — |

### Detailed IPC Contracts

#### `agent:start` — Start Auto-Navigation

```
Direction:  Renderer → Main (invoke/handle)
Input:      { prompt: string }
            Example: { prompt: "Go to Amazon and find a USB-C cable under $10" }
Output:     Promise<AgentResult>
            Example: {
              status: 'completed',
              totalSteps: 7,
              finalUrl: 'https://www.amazon.com/s?k=usb+c+cable&...',
              finalTitle: 'Amazon.com: usb c cable',
              summary: 'Found USB-C cables under $10. The cheapest is $5.99.'
            }
Errors:     Throws if:
            - No active tab
            - Agent already running
            - AI provider not configured
```

#### `agent:stop` — Stop Running Agent

```
Direction:  Renderer → Main (send/on)
Input:      (none)
Behavior:   Sets the orchestrator's abort flag.
            The loop breaks at the next iteration.
```

#### `agent:step` — Step Progress Update

```
Direction:  Main → Renderer (send)
Payload:    StepUpdate object
            Example: {
              step: 3,
              tool: 'type_text',
              args: { index: 1, text: 'London' },
              result: "Typed 'London' into input",
              status: 'done',
              timestamp: 1695580800000
            }
```

#### `agent:status` — Agent Status Change

```
Direction:  Main → Renderer (send)
Payload:    StatusChange object
            Example: {
              status: 'running'
            }
            Example: {
              status: 'completed',
              summary: 'Successfully found the cheapest flight.'
            }
```

### 6B. Preload Bridge Additions

Add to `src/preload/preload.js`:

```js
contextBridge.exposeInMainWorld('agent', {
  start: (prompt) => ipcRenderer.invoke('agent:start', { prompt }),
  stop: () => ipcRenderer.send('agent:stop'),
  onStep: (cb) => ipcRenderer.on('agent:step', (_, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('agent:status', (_, data) => cb(data))
})
```

This exposes `window.agent` in the renderer context with 4 methods.

---

## 7. Phase 5 — Renderer UI (Agent Panel)

### 7A. UI Design

The Agent Panel is a **bottom sheet / drawer** that slides up from the bottom of the main content area (different from the Ask AI side panel which slides from the right). This separation keeps both features usable independently.

### Panel States

| State | Visual |
|-------|--------|
| **Closed** | Panel is hidden. Only the "Auto Navigate" button is visible in the toolbar. |
| **Open — Idle** | Panel is visible with a prompt input and "Run" button. Step log is empty. |
| **Open — Running** | Prompt input is disabled. Step log shows real-time updates. "Stop" button visible. Pulsing status indicator. |
| **Open — Completed** | Step log shows all steps. Summary displayed. "Run Again" button. |
| **Open — Error** | Error message displayed. "Try Again" button. |

### HTML Structure (to add in `index.html`)

```html
<!-- Auto-Navigation Agent Panel -->
<aside id="agent-panel" class="agent-panel" aria-hidden="true">
  <div class="agent-panel-header">
    <div class="agent-panel-title">
      <svg><!-- robot/autopilot icon --></svg>
      <h3>Auto Navigate</h3>
      <span id="agent-status-badge" class="agent-status-badge">Idle</span>
    </div>
    <button id="agent-panel-close" type="button" class="agent-panel-close-btn"
            aria-label="Close Agent panel">✕</button>
  </div>

  <div id="agent-step-log" class="agent-step-log">
    <div class="agent-empty-state">
      Describe what you want to do, and the browser will navigate automatically.
    </div>
  </div>

  <div id="agent-summary" class="agent-summary" style="display: none;"></div>

  <form id="agent-form" class="agent-form">
    <textarea id="agent-input"
              placeholder="e.g. Go to YouTube and search for 'JavaScript tutorials'"
              rows="2"></textarea>
    <div class="agent-form-actions">
      <button id="agent-run-btn" type="submit">Run</button>
      <button id="agent-stop-btn" type="button" style="display: none;">Stop</button>
    </div>
  </form>
</aside>
```

### Toolbar Button (to add in `index.html` toolbar section)

```html
<button id="auto-nav" title="Auto Navigate">
  <svg><!-- autopilot/compass icon --></svg>
  Auto Navigate
</button>
```

Style the button identically to the existing `#ask-ai` button but with a different accent color (e.g., a green/teal gradient: `rgba(34, 197, 94, ...)`) to visually distinguish the two features.

### 7B. Step Log Entry Rendering

Each step update from the IPC is rendered as a card in the step log:

```html
<div class="agent-step" data-status="done">
  <div class="step-header">
    <span class="step-number">Step 3</span>
    <span class="step-tool">type_text</span>
    <span class="step-status">✓</span>
  </div>
  <div class="step-detail">
    Typed "London" into input[placeholder="Where to?"]
  </div>
</div>
```

### 7C. CSS Design Guidelines (for `auto_nav.css`)

- **Panel position**: Fixed to bottom of `#main-content`, slides up with `transform: translateY(100%)` → `translateY(0)`
- **Panel height**: 320px default, with a drag handle to resize (stretch goal)
- **Glass morphism**: Same `backdrop-filter: blur(24px)` treatment as sidebar
- **Step cards**: Subtle left border color-coded by status:
  - `executing` → pulsing blue (`var(--accent)`)
  - `done` → green (`#22c55e`)
  - `error` → red (`#ef4444`)
  - `thinking` → amber (`#f59e0b`)
- **Status badge**: Small pill next to the title showing current state with matching color
- **Animations**: Step cards slide in from bottom with a staggered fade-in

### 7D. Client Script: `src/renderer/ai/features/auto_nav/autoNavClient.js`

```js
/**
 * Self-executing module that:
 * 1. Attaches event listeners to Agent Panel UI elements
 * 2. Handles form submit → calls window.agent.start(prompt)
 * 3. Listens to window.agent.onStep() and renders step cards
 * 4. Listens to window.agent.onStatus() and updates status badge/buttons
 * 5. Handles stop button → calls window.agent.stop()
 */
```

### Input

- `prompt` string from `#agent-input` textarea

### Output (UI side effects)

- Renders step cards into `#agent-step-log`
- Updates `#agent-status-badge` text and color
- Toggles `#agent-run-btn` / `#agent-stop-btn` visibility
- Shows `#agent-summary` when agent completes
- Disables/enables `#agent-input` based on running state

---

## 8. Phase 6 — Agentic Loop & Convergence Logic

### 8A. LLM Integration with Tool/Function Calling

The existing `src/main/ai/core/llmGateway.js` needs a new function that supports tool/function calling:

### New Function: `generateWithTools()`

```js
/**
 * Sends a conversation with tool definitions to the LLM and returns
 * either a tool call or a text response.
 *
 * @param {Object} params
 * @param {Object}   params.settings         - { provider, model, apiKey }
 * @param {Array}    params.messages         - Conversation history in OpenAI message format
 * @param {Array}    params.tools            - Tool definitions array (TOOL_DEFINITIONS)
 * @returns {Promise<LLMToolResponse>}
 */
async function generateWithTools({ settings, messages, tools }) → Promise<LLMToolResponse>
```

### Output Schema: `LLMToolResponse`

```js
/**
 * @typedef {Object} LLMToolResponse
 * @property {'tool_call' | 'text'} type
 * @property {string}  [text]             - Present when type is 'text'
 * @property {string}  [toolCallId]       - Unique ID for the tool call
 * @property {string}  [toolName]         - Name of the tool to call
 * @property {Object}  [toolArgs]         - Parsed arguments for the tool
 * @property {Object}  rawResponse        - Full raw LLM API response for debugging
 */
```

### Gemini Provider Changes

`src/main/ai/providers/geminiProvider.js` needs a new export:

```js
/**
 * @function generateWithGeminiTools
 * @param {Object} params
 * @param {string}  params.apiKey
 * @param {string}  params.model
 * @param {Array}   params.messages   - Conversation in Gemini's contents format
 * @param {Array}   params.tools      - Tool definitions (converted to Gemini's format)
 * @returns {Promise<LLMToolResponse>}
 *
 * Implementation notes:
 * - Convert OpenAI-style tool definitions to Gemini's `tools` format:
 *   { functionDeclarations: [{ name, description, parameters }] }
 * - Convert OpenAI-style messages to Gemini's `contents` array:
 *   { role: 'user'|'model', parts: [{ text }] }
 * - For tool calls, Gemini returns: candidates[0].content.parts[0].functionCall
 *   → { name: string, args: object }
 * - For tool results, send as:
 *   { role: 'user', parts: [{ functionResponse: { name, response } }] }
 */
```

### OpenAI Provider Changes

`src/main/ai/providers/openaiProvider.js` needs a new export:

```js
/**
 * @function generateWithOpenAITools
 * @param {Object} params
 * @param {string}  params.apiKey
 * @param {string}  params.model
 * @param {Array}   params.messages   - Standard OpenAI messages array
 * @param {Array}   params.tools      - Tool definitions in OpenAI format (already correct)
 * @returns {Promise<LLMToolResponse>}
 *
 * Implementation notes:
 * - Pass `tools` directly in the request body
 * - Set `tool_choice: "auto"` to let the model decide
 * - When response contains `choices[0].message.tool_calls`:
 *   → Extract first tool call: { id, function: { name, arguments } }
 *   → Parse arguments from JSON string
 * - For tool results, send as:
 *   { role: 'tool', tool_call_id, content: JSON.stringify(result) }
 */
```

### 8B. Conversation History Format

The orchestrator maintains messages in **OpenAI format** internally, and the providers convert as needed:

```js
// System message (first message, set once)
{
  role: 'system',
  content: SYSTEM_PROMPT  // from promptTemplates.js
}

// User message (one per step — the DOM snapshot)
{
  role: 'user',
  content: 'Step 3. Current page state:\n[DOM snapshot text]'
}

// Assistant message with tool call
{
  role: 'assistant',
  tool_calls: [{
    id: 'call_abc123',
    type: 'function',
    function: { name: 'click', arguments: '{"index": 2}' }
  }]
}

// Tool result message
{
  role: 'tool',
  tool_call_id: 'call_abc123',
  content: '{"success": true, "message": "Clicked button \'Search\'"}'
}
```

### 8C. Prompt Templates

### File: `src/main/ai/features/auto_nav/promptTemplates.js`

#### System Prompt

```js
const SYSTEM_PROMPT = `You are an autonomous browser navigation agent embedded in the
LightSail web browser. Your job is to fulfill the user's goal by interacting with web pages.

## How you work
1. You receive a snapshot of the current page showing all interactive elements with
   index numbers.
2. You choose ONE action per step using the available tools.
3. After each action, you'll receive an updated page snapshot.
4. Repeat until the goal is achieved, then call the 'done' tool.

## Rules
- Call exactly ONE tool per response. Never call multiple tools.
- Always use element index numbers from the CURRENT snapshot (they change between steps).
- After clicking links or submitting forms, use 'wait' to let the page load.
- If a page needs scrolling to find elements, use 'scroll' first.
- If you're stuck or the goal is impossible, call 'done' with success=false and explain why.
- Never make up URLs. Only navigate to URLs you can see in the page or that you know
  are correct.
- Prefer clicking existing links/buttons over direct URL navigation when possible.
- For search inputs, always type the query and press Enter (pressEnter: true).
- Be concise in your reasoning. Focus on actions, not explanations.
- NEVER try to interact with cookie banners, login popups, or permission dialogs unless
  the user's goal specifically requires it. Dismiss them if they block progress.
- Maximum ${MAX_STEPS} steps allowed. Be efficient.`
```

#### User Prompt (per step)

```js
function buildStepPrompt(stepNumber, snapshotText) {
  return `Step ${stepNumber}. Current page state:\n${snapshotText}`
}
```

#### Initial User Prompt (first message after system)

```js
function buildGoalPrompt(userGoal) {
  return `My goal: ${userGoal}\n\nPlease start working on this goal. Begin by analyzing
  the current page and deciding what to do first.`
}
```

---

## 9. Phase 7 — Safety, Guardrails & Error Handling

### 9A. Step Limit

```js
const MAX_STEPS = 15
```

If the agent hasn't completed after 15 iterations, force-stop and return `status: 'max_steps_reached'`.

### 9B. URL Safety

Before executing `navigate` or following a link, validate:
- URL must start with `http://` or `https://`
- Block `javascript:`, `data:`, `file://`, `chrome://`, `electron://` schemes
- Block navigation to known dangerous patterns (e.g., URLs containing `login`, `payment`, `checkout` — this is configurable)

```js
/**
 * @param {string} url
 * @returns {boolean} True if the URL is safe to navigate to
 */
function isUrlSafe(url) → boolean
```

### 9C. Sensitive Action Confirmation (Stretch Goal)

For future implementation: before executing actions on pages containing sensitive forms (passwords, payment info), pause the agent and ask the user for confirmation via a modal in the renderer.

### 9D. Error Recovery

If an action fails (element not found, script error), the executor returns:
```js
{ success: false, message: "...", error: "Element with index 7 not found on page" }
```

This is appended to the conversation as a tool result, and the LLM can recover by choosing a different action on the next step.

### 9E. Page Load Timeouts

After `navigate` or `click` actions that trigger navigation:
- Wait for the `did-finish-load` event on the webContents
- Timeout after 15 seconds
- If timeout, return `{ success: true, message: "Navigation started but page still loading after 15s" }` — let the LLM decide whether to wait more

### 9F. Concurrent Agent Prevention

Only one agent session can run at a time. If `agent:start` is called while an agent is already running:
- Throw an error: `"An agent is already running. Stop it first."`

---

## 10. Phase 8 — Polish, Testing & Edge Cases

### 10A. Visual Element Markers

During the DOM snapshot phase, inject small colored badges on each interactive element:

```
┌──────────────────────┐
│  [0] 🔵  Google Search │  ← Blue badge with index "0" overlaid on the search button
└──────────────────────┘
```

- Badges use `position: absolute` with a high `z-index`
- Background: semi-transparent blue (`rgba(79, 158, 255, 0.85)`)
- Font: 11px white bold
- Border-radius: 4px
- Positioned at the top-left corner of the element
- **Removed** at the start of each new snapshot cycle (before re-creating)

### 10B. Marker Cleanup

```js
/**
 * Removes all injected autonav markers from the page.
 * Called at the start of each snapshot and when the agent stops.
 *
 * @param {Electron.WebContents} webContents
 */
async function cleanupMarkers(webContents)
```

The cleanup script runs:
```js
document.querySelectorAll('[data-autonav-marker]').forEach(el => el.remove())
document.querySelectorAll('[data-autonav-index]').forEach(el => {
  el.removeAttribute('data-autonav-index')
})
```

### 10C. Edge Cases to Handle

| Scenario | Handling |
|----------|----------|
| Page has no interactive elements | LLM receives empty elements list, should scroll or navigate |
| Element disappears between snapshot and click | ActionExecutor returns error, LLM retakes snapshot |
| Page opens a popup/new window | Ignore popups, keep working in the current tab |
| Page has iframes | Initial version: ignore iframe content (document in scope only) |
| Very large pages (100+ interactive elements) | Cap at first 75 elements, note truncation in snapshot |
| CAPTCHA encountered | LLM calls `done` with `success: false` and explains the blocker |
| Cookie consent banner | LLM should dismiss it if it blocks the goal |
| Alert/confirm dialogs | Auto-dismiss via `webContents.on('dialog')` handler |
| Page redirects continuously | Step limit prevents infinite loops |

### 10D. Dialog Auto-Dismiss

In the orchestrator, attach a handler before starting the loop:

```js
webContents.on('dialog', (event, dialog) => {
  event.preventDefault()
  dialog.dismiss()
})
```

This prevents `alert()`, `confirm()`, and `prompt()` dialogs from blocking the agent.

---

## 11. New Dependencies

| Package | Purpose | Install Command |
|---------|---------|-----------------|
| *(none required)* | The entire implementation uses Electron's built-in `webContents.executeJavaScript()` for DOM interaction, and the existing `fetch`-based LLM providers for AI calls. No new npm packages are needed. | — |

> **Note**: The existing Gemini and OpenAI providers already use `fetch` (built into Node 18+ / Electron 41). Tool/function calling is a feature of the API, not a library.

---

## 12. Complete File Manifest

### New Files (9 files)

```
src/
├── main/
│   └── ai/
│       └── features/
│           └── auto_nav/
│               ├── autoNavService.js        ← IPC entry point, creates orchestrator
│               ├── agentOrchestrator.js      ← Agentic loop (observe → think → act)
│               ├── domSnapshotBuilder.js     ← DOM snapshot extraction + marker injection
│               ├── actionExecutor.js         ← Translates tool calls → executeJavaScript
│               ├── toolDefinitions.js        ← Tool schemas for LLM function calling
│               ├── promptTemplates.js        ← System prompt & user prompt builders
│               └── autoNavTypes.js           ← Constants (MAX_STEPS, status enums, types)
├── renderer/
│   ├── ai/
│   │   └── features/
│   │       └── auto_nav/
│   │           └── autoNavClient.js          ← UI event handling for Agent Panel
│   └── styles/
│       └── auto_nav.css                      ← Agent Panel styles
```

### Modified Files (8 files)

| File | Summary of Changes |
|------|-------------------|
| `src/main/ipcHandlers.js` | +4 lines: instantiate `AutoNavService`, register `agent:start`, `agent:stop` handlers |
| `src/preload/preload.js` | +6 lines: expose `window.agent` bridge with `start`, `stop`, `onStep`, `onStatus` |
| `src/renderer/index.html` | +30 lines: Agent Panel HTML markup, toolbar button, script/CSS imports |
| `src/renderer/scripts/index.js` | +20 lines: Agent Panel toggle logic, layout bounds update |
| `src/renderer/styles/main.css` | +5 lines: Layout integration for `#app.agent-open` state |
| `src/main/ai/core/llmGateway.js` | +15 lines: new `generateWithTools()` function |
| `src/main/ai/providers/geminiProvider.js` | +60 lines: new `generateWithGeminiTools()` function |
| `src/main/ai/providers/openaiProvider.js` | +40 lines: new `generateWithOpenAITools()` function |

---

## Implementation Order

Recommended order of implementation to minimize blocked dependencies:

| Order | Phase | Description | Depends On |
|-------|-------|-------------|------------|
| 1 | Phase 3A | `toolDefinitions.js` — Pure data, no dependencies | Nothing |
| 2 | Phase 6C | `promptTemplates.js` — Pure strings, no dependencies | Nothing |
| 3 | Phase 3A | `autoNavTypes.js` — Constants and JSDoc types | Nothing |
| 4 | Phase 1 | `domSnapshotBuilder.js` — DOM extraction engine | Nothing |
| 5 | Phase 3B | `actionExecutor.js` — Action execution engine | toolDefinitions |
| 6 | Phase 6A | Modify LLM providers + gateway for tool calling | Nothing |
| 7 | Phase 2 | `agentOrchestrator.js` — The agentic loop | Steps 4, 5, 6 |
| 8 | Phase 4A | `autoNavService.js` — IPC wrapper | Step 7 |
| 9 | Phase 4B | Modify `ipcHandlers.js` + `preload.js` | Step 8 |
| 10 | Phase 5 | Renderer UI (HTML, CSS, client JS) | Step 9 |
| 11 | Phase 7 | Safety guardrails | Steps 7, 8 |
| 12 | Phase 8 | Polish, markers, edge cases | Everything |

---

## Data Flow Summary

```
User types prompt
        │
        ▼
[Renderer] ──agent:start──▶ [Main: AutoNavService]
                                     │
                                     ▼
                            [AgentOrchestrator.run()]
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            buildDOMSnapshot   generateWithTools   actionExecutor
            (executeJS in tab)  (Gemini/OpenAI)    (executeJS in tab)
                    │                │                │
                    │        ┌───────┘                │
                    │        │ tool_call              │
                    │        ▼                        │
                    │   Parse tool call ──────────────┘
                    │        │
                    │        ▼
                    │   agent:step ──▶ [Renderer: step log card]
                    │        │
                    │        ▼
                    └── Loop back to snapshot
                             │
                             ▼ (done or max steps)
                       agent:status ──▶ [Renderer: final state]
                             │
                             ▼
                    Return AgentResult
```
