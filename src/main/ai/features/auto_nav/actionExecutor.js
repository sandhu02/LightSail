/**
 * Action Executor for Auto-Navigation Agent.
 * Translates LLM tool calls into executeJavaScript and WebContents navigation commands.
 */

/**
 * Checks if a URL is safe for navigation.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isUrlSafe(url) {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch (err) {
    return false
  }
}

class ActionExecutor {
  /**
   * @param {Electron.WebContents} webContents - The active tab's webContents
   */
  constructor(webContents) {
    this.webContents = webContents
  }

  /**
   * Executes a single tool call on the page.
   *
   * @param {string} toolName - One of: 'click', 'type_text', 'navigate', 'scroll', 'wait', 'select_option', 'go_back', 'done'
   * @param {Object} toolArgs - Arguments for the tool
   * @returns {Promise<import('./autoNavTypes').ActionResult>}
   */
  async execute(toolName, toolArgs = {}) {
    if (!this.webContents || this.webContents.isDestroyed()) {
      return { success: false, message: 'WebContents is not available or destroyed', error: 'WebContents destroyed' }
    }

    try {
      switch (toolName) {
        case 'click':
          return await this._executeClick(toolArgs)
        case 'type_text':
          return await this._executeTypeText(toolArgs)
        case 'navigate':
          return await this._executeNavigate(toolArgs)
        case 'scroll':
          return await this._executeScroll(toolArgs)
        case 'wait':
          return await this._executeWait(toolArgs)
        case 'select_option':
          return await this._executeSelectOption(toolArgs)
        case 'go_back':
          return await this._executeGoBack(toolArgs)
        case 'done':
          return this._executeDone(toolArgs)
        default:
          return {
            success: false,
            message: `Unknown tool: "${toolName}"`,
            error: `Unsupported tool: ${toolName}`
          }
      }
    } catch (err) {
      return {
        success: false,
        message: `Failed to execute ${toolName}: ${err.message}`,
        error: err.message
      }
    }
  }

  async _executeClick({ index }) {
    if (typeof index !== 'number' || isNaN(index)) {
      return { success: false, message: 'Invalid or missing element index for click', error: 'Missing index' }
    }

    const script = `(() => {
      const idx = ${JSON.stringify(index)};
      const el = document.querySelector(\`[data-autonav-index="\${idx}"]\`);
      if (!el) {
        return { success: false, error: \`Element with index \${idx} not found on page\` };
      }

      try {
        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      } catch (e) {}

      const tag = el.tagName.toLowerCase();
      const text = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 50);

      // Trigger focus and mouse events for high framework compatibility
      if (typeof el.focus === 'function') el.focus();

      const rect = el.getBoundingClientRect();
      const mouseOpts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      };

      el.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      el.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      el.click();

      return {
        success: true,
        message: \`Clicked <\${tag}>\${text ? ' "' + text + '"' : ''}\`
      };
    })()`

    const result = await this.webContents.executeJavaScript(script)
    if (!result.success) {
      return { success: false, message: result.error, error: result.error }
    }
    return result
  }

  async _executeTypeText({ index, text, pressEnter = false }) {
    if (typeof index !== 'number' || isNaN(index)) {
      return { success: false, message: 'Invalid or missing element index for type_text', error: 'Missing index' }
    }

    const textValue = typeof text === 'string' ? text : String(text || '')

    const script = `(() => {
      const idx = ${JSON.stringify(index)};
      const textToType = ${JSON.stringify(textValue)};
      const shouldPressEnter = ${Boolean(pressEnter)};

      const el = document.querySelector(\`[data-autonav-index="\${idx}"]\`);
      if (!el) {
        return { success: false, error: \`Element with index \${idx} not found on page\` };
      }

      try {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      } catch (e) {}
      if (typeof el.focus === 'function') el.focus();

      // Support React/framework controlled input setters
      const tag = el.tagName.toLowerCase();
      const isInput = tag === 'input';
      const isTextArea = tag === 'textarea';

      if (isInput || isTextArea) {
        const proto = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(el, textToType);
        } else {
          el.value = textToType;
        }
      } else if (el.isContentEditable) {
        el.innerText = textToType;
      } else {
        el.value = textToType;
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      if (shouldPressEnter) {
        const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));

        if (el.form) {
          if (typeof el.form.requestSubmit === 'function') {
            try { el.form.requestSubmit(); } catch (e) { el.form.submit(); }
          } else if (typeof el.form.submit === 'function') {
            el.form.submit();
          }
        }
      }

      const placeholder = el.getAttribute('placeholder') || '';
      const desc = placeholder ? \`[placeholder="\${placeholder}"]\` : \`<\${tag}>\`;

      return {
        success: true,
        message: \`Typed "\${textToType}" into \${desc}\${shouldPressEnter ? ' and pressed Enter' : ''}\`
      };
    })()`

    const result = await this.webContents.executeJavaScript(script)
    if (!result.success) {
      return { success: false, message: result.error, error: result.error }
    }
    return result
  }

  async _executeNavigate({ url }) {
    if (!url || typeof url !== 'string') {
      return { success: false, message: 'URL is required for navigation', error: 'Missing URL' }
    }

    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl
    }

    if (!isUrlSafe(targetUrl)) {
      return { success: false, message: `Blocked unsafe URL: ${targetUrl}`, error: 'Unsafe URL scheme' }
    }

    // Wait for did-finish-load or 15s timeout
    await new Promise((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      }, 15000)

      const onFinish = () => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      }

      const onFail = () => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this.webContents.removeListener('did-finish-load', onFinish)
        this.webContents.removeListener('did-fail-load', onFail)
      }

      this.webContents.once('did-finish-load', onFinish)
      this.webContents.once('did-fail-load', onFail)

      this.webContents.loadURL(targetUrl).catch(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      })
    })

    return {
      success: true,
      message: `Navigated to ${targetUrl}`,
      data: { url: targetUrl }
    }
  }

  async _executeScroll({ direction, amount = 500 }) {
    const dir = direction === 'up' ? 'up' : 'down'
    const px = Math.min(Math.max(Number(amount) || 500, 50), 3000)
    const delta = dir === 'up' ? -px : px

    await this.webContents.executeJavaScript(`(() => {
      window.scrollBy({ top: ${delta}, behavior: 'smooth' });
    })()`)

    // Allow smooth scroll to settle
    await new Promise(r => setTimeout(r, 400))

    return {
      success: true,
      message: `Scrolled ${dir} ${px}px`
    }
  }

  async _executeWait({ milliseconds = 2000 }) {
    const ms = Math.min(Math.max(Number(milliseconds) || 2000, 100), 5000)
    await new Promise(r => setTimeout(r, ms))
    return {
      success: true,
      message: `Waited ${ms}ms`
    }
  }

  async _executeSelectOption({ index, value }) {
    if (typeof index !== 'number' || isNaN(index)) {
      return { success: false, message: 'Invalid or missing index for select_option', error: 'Missing index' }
    }

    const script = `(() => {
      const idx = ${JSON.stringify(index)};
      const searchVal = String(${JSON.stringify(value || '')}).toLowerCase();

      const el = document.querySelector(\`[data-autonav-index="\${idx}"]\`);
      if (!el || el.tagName.toLowerCase() !== 'select') {
        return { success: false, error: \`Select dropdown with index \${idx} not found\` };
      }

      let matched = false;
      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        if (opt.value.toLowerCase() === searchVal || opt.text.toLowerCase().includes(searchVal)) {
          el.selectedIndex = i;
          matched = true;
          break;
        }
      }

      if (!matched && el.options.length > 0) {
        el.selectedIndex = 0;
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));

      return {
        success: true,
        message: \`Selected "\${value}" in dropdown\`
      };
    })()`

    const result = await this.webContents.executeJavaScript(script)
    if (!result.success) {
      return { success: false, message: result.error, error: result.error }
    }
    return result
  }

  async _executeGoBack() {
    if (this.webContents.canGoBack()) {
      this.webContents.goBack()
      await new Promise(r => setTimeout(r, 1200))
      return {
        success: true,
        message: 'Navigated back to previous page'
      }
    }
    return {
      success: false,
      message: 'Cannot go back, browsing history is empty',
      error: 'History empty'
    }
  }

  _executeDone({ summary, success = true }) {
    const isSuccess = Boolean(success)
    const sum = summary || (isSuccess ? 'Task completed successfully.' : 'Task ended.')
    return {
      success: isSuccess,
      message: `Task complete: ${sum}`,
      data: {
        summary: sum,
        success: isSuccess
      }
    }
  }
}

module.exports = { ActionExecutor, isUrlSafe }
