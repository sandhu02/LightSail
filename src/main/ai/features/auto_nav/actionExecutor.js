/**
 * Action Executor for Auto-Navigation Agent.
 * Translates LLM tool calls into executeJavaScript and WebContents navigation commands.
 */

const { clipboard } = require('electron')

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
    this.lastReadText = ''
    this.lastCopiedText = ''
  }

  /**
   * Executes a single tool call on the page.
   *
   * @param {string} toolName - One of: 'click', 'type_text', 'navigate', 'scroll', 'wait', 'select_option', 'go_back', 'read_text', 'copy_to_clipboard', 'paste_text', 'done'
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
        case 'read_text':
          return await this._executeReadText(toolArgs)
        case 'copy_to_clipboard':
          return await this._executeCopyToClipboard(toolArgs)
        case 'paste_text':
          return await this._executePasteText(toolArgs)
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
      } else if (el.isContentEditable || el.getAttribute('role') === 'textbox' || el.getAttribute('contenteditable') !== null) {
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, textToType);
        } catch (e) {}
        if (!inserted || !el.innerText?.includes(textToType)) {
          el.innerText = textToType;
        }
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

  async _executeReadText({ index, selector, maxLength = 8000 } = {}) {
    const limit = Math.min(Math.max(Number(maxLength) || 8000, 100), 20000)

    const script = `(() => {
      const idx = ${index !== undefined && index !== null && !isNaN(index) ? JSON.stringify(index) : 'null'};
      const sel = ${selector && typeof selector === 'string' ? JSON.stringify(selector) : 'null'};
      const maxLen = ${limit};

      let extracted = '';
      let sourceDesc = '';

      if (idx !== null) {
        const el = document.querySelector(\`[data-autonav-index="\${idx}"]\`);
        if (!el) {
          return { success: false, error: \`Element with index \${idx} not found on page\` };
        }
        extracted = (el.innerText || el.textContent || el.value || '').trim();
        sourceDesc = \`element [\${idx}] <\${el.tagName.toLowerCase()}>\`;
      } else if (sel) {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length === 0) {
          return { success: false, error: \`No elements found matching selector "\${sel}"\` };
        }
        extracted = els.map(e => (e.innerText || e.textContent || '').trim()).filter(Boolean).join('\\n\\n');
        sourceDesc = \`selector "\${sel}" (\${els.length} elements)\`;
      } else {
        // Smart article / main content detection
        const candidate = document.querySelector('article, main, [role="main"], .article, .post, .story-body, #content');
        if (candidate) {
          extracted = (candidate.innerText || candidate.textContent || '').trim();
          sourceDesc = \`<\${candidate.tagName.toLowerCase()}>\`;
        } else {
          // Fallback: extract headings and paragraphs from body
          const nodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, blockquote, li'));
          const cleanNodes = nodes.filter(n => {
            const style = window.getComputedStyle(n);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (n.closest('nav, header, footer, script, style, [data-autonav-marker]')) return false;
            return true;
          });

          if (cleanNodes.length > 0) {
            extracted = cleanNodes.map(n => (n.innerText || n.textContent || '').trim()).filter(Boolean).join('\\n\\n');
            sourceDesc = 'page article body';
          } else {
            extracted = (document.body ? document.body.innerText || '' : '').trim();
            sourceDesc = 'entire page';
          }
        }
      }

      // Normalize whitespace
      extracted = extracted.replace(/[ \\t]+/g, ' ').replace(/\\n{3,}/g, '\\n\\n').trim();
      const isTruncated = extracted.length > maxLen;
      const finalText = extracted.slice(0, maxLen);
      const wordCount = finalText.trim() ? finalText.trim().split(/\\s+/).length : 0;

      return {
        success: true,
        text: finalText,
        length: finalText.length,
        totalLength: extracted.length,
        isTruncated,
        wordCount,
        sourceDesc
      };
    })()`

    const result = await this.webContents.executeJavaScript(script)
    if (!result.success) {
      return { success: false, message: result.error, error: result.error }
    }

    this.lastReadText = result.text
    const preview = result.text.slice(0, 100).replace(/\n/g, ' ')
    const truncationNote = result.isTruncated ? ` (truncated to ${result.length}/${result.totalLength} chars)` : ''

    return {
      success: true,
      message: `Read ${result.length} characters (${result.wordCount} words) from ${result.sourceDesc}${truncationNote}: "${preview}..."`,
      data: {
        text: result.text,
        length: result.length,
        wordCount: result.wordCount,
        source: result.sourceDesc
      }
    }
  }

  async _executeCopyToClipboard({ text, index, selector } = {}) {
    let textToCopy = typeof text === 'string' ? text : ''

    if (!textToCopy) {
      if (index !== undefined && index !== null && !isNaN(index)) {
        const readRes = await this._executeReadText({ index })
        if (readRes.success && readRes.data?.text) {
          textToCopy = readRes.data.text
        } else {
          return { success: false, message: readRes.error || 'Failed to extract text from element to copy', error: readRes.error }
        }
      } else if (selector && typeof selector === 'string') {
        const readRes = await this._executeReadText({ selector })
        if (readRes.success && readRes.data?.text) {
          textToCopy = readRes.data.text
        } else {
          return { success: false, message: readRes.error || 'Failed to extract text from selector to copy', error: readRes.error }
        }
      } else if (this.lastReadText) {
        textToCopy = this.lastReadText
      } else {
        return {
          success: false,
          message: 'No text, element index, or selector provided to copy to clipboard',
          error: 'Missing text or target'
        }
      }
    }

    try {
      clipboard.writeText(textToCopy)
      this.lastCopiedText = textToCopy
      const preview = textToCopy.slice(0, 80).replace(/\n/g, ' ')
      return {
        success: true,
        message: `Copied ${textToCopy.length} characters to system clipboard: "${preview}${textToCopy.length > 80 ? '...' : ''}"`,
        data: {
          text: textToCopy.slice(0, 500),
          length: textToCopy.length
        }
      }
    } catch (err) {
      return {
        success: false,
        message: `Failed to copy to clipboard: ${err.message}`,
        error: err.message
      }
    }
  }

  async _executePasteText({ index, text } = {}) {
    if (typeof index !== 'number' || isNaN(index)) {
      return { success: false, message: 'Invalid or missing element index for paste_text', error: 'Missing index' }
    }

    let textToPaste = typeof text === 'string' && text ? text : clipboard.readText()
    if (!textToPaste && this.lastCopiedText) {
      textToPaste = this.lastCopiedText
    }

    if (!textToPaste) {
      return {
        success: false,
        message: 'No text provided and clipboard is empty',
        error: 'Empty clipboard'
      }
    }

    const script = `(() => {
      const idx = ${JSON.stringify(index)};
      const pasteData = ${JSON.stringify(textToPaste)};

      const el = document.querySelector(\`[data-autonav-index="\${idx}"]\`);
      if (!el) {
        return { success: false, error: \`Element with index \${idx} not found on page\` };
      }

      try {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      } catch (e) {}

      if (typeof el.focus === 'function') el.focus();

      const tag = el.tagName.toLowerCase();
      const isInput = tag === 'input';
      const isTextArea = tag === 'textarea';
      const isEditable = el.isContentEditable || el.getAttribute('role') === 'textbox' || el.getAttribute('contenteditable') !== null;

      if (isEditable) {
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, pasteData);
        } catch (e) {}

        if (!inserted || !el.innerText?.includes(pasteData)) {
          // If insertText command wasn't handled, append or insert into range
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(pasteData);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            el.innerText = (el.innerText || '') + pasteData;
          }
        }
      } else if (isInput || isTextArea) {
        const proto = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const curVal = el.value || '';
        const newVal = curVal ? (curVal + ' ' + pasteData) : pasteData;
        if (nativeSetter) {
          nativeSetter.call(el, newVal);
        } else {
          el.value = newVal;
        }
      } else {
        el.innerText = pasteData;
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        success: true,
        tag,
        length: pasteData.length
      };
    })()`

    const result = await this.webContents.executeJavaScript(script)
    if (!result.success) {
      return { success: false, message: result.error, error: result.error }
    }

    const preview = textToPaste.slice(0, 60).replace(/\n/g, ' ')
    return {
      success: true,
      message: `Pasted ${textToPaste.length} characters into <${result.tag}>: "${preview}${textToPaste.length > 60 ? '...' : ''}"`
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
