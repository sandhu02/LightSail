/**
 * JSDoc typedefs and constants for autonomous navigation agent.
 */

const MAX_STEPS = 15

const AGENT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
  MAX_STEPS_REACHED: 'max_steps_reached',
  ERROR: 'error'
}

const STEP_STATUS = {
  EXECUTING: 'executing',
  DONE: 'done',
  THINKING: 'thinking',
  ERROR: 'error'
}

/**
 * @typedef {Object} InteractiveElement
 * @property {number}  index       - Unique sequential index (0, 1, 2, ...)
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

/**
 * @typedef {Object} DOMSnapshot
 * @property {string} url             - Current page URL (window.location.href)
 * @property {string} title           - Current page title (document.title)
 * @property {InteractiveElement[]} elements - All interactive elements on the page
 * @property {boolean} truncated      - Whether element list was truncated to max limit
 * @property {string} pageText        - Visible body text, truncated to 8000 chars
 * @property {Object} scrollInfo      - Scroll position and page dimensions
 * @property {number} scrollInfo.scrollX      - Current horizontal scroll
 * @property {number} scrollInfo.scrollY      - Current vertical scroll
 * @property {number} scrollInfo.scrollHeight - Total scrollable height
 * @property {number} scrollInfo.viewportHeight - Visible viewport height
 * @property {number} scrollInfo.viewportWidth  - Visible viewport width
 */

/**
 * @typedef {Object} ActionResult
 * @property {boolean} success    - Whether the action executed without error
 * @property {string}  message    - Human-readable description of what happened
 * @property {string}  [error]    - Error message if success is false
 * @property {Object}  [data]     - Any additional data (e.g., new URL after navigate)
 */

/**
 * @typedef {Object} AgentResult
 * @property {'completed' | 'max_steps_reached' | 'stopped' | 'error'} status
 * @property {number}  totalSteps  - How many loop iterations ran
 * @property {string}  finalUrl    - URL of the page when the agent stopped
 * @property {string}  finalTitle  - Title of the page when the agent stopped
 * @property {string}  [summary]   - The LLM's final summary (from 'done' tool)
 * @property {string}  [error]     - Error message if status is 'error'
 */

/**
 * @typedef {Object} StepUpdate
 * @property {number}  step                - Current step number (0-indexed or 1-indexed)
 * @property {string}  [tool]              - Tool name that was called
 * @property {Object}  [args]              - Arguments passed to the tool
 * @property {string}  [result]            - Result/outcome of the tool execution
 * @property {string}  [message]           - Plain text thinking from the LLM
 * @property {'executing' | 'done' | 'thinking' | 'error'} status
 * @property {number}  timestamp           - Date.now()
 */

/**
 * @typedef {Object} StatusChange
 * @property {'idle' | 'running' | 'completed' | 'stopped' | 'max_steps_reached' | 'error'} status
 * @property {string}  [summary]
 * @property {string}  [error]
 */

module.exports = {
  MAX_STEPS,
  AGENT_STATUS,
  STEP_STATUS
}
