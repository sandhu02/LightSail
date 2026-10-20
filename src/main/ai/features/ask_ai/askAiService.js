const { generateCustomChatResponse } = require('../../core/customChatGateway')

class AskAiService {
  constructor(tabs, aiSettingsService) {
    this.tabs = tabs
    this.aiSettingsService = aiSettingsService

    this.sessionId = ''
  }

  async ask(prompt, uid = '') {
    if (!prompt || !prompt.trim()) throw new Error('Prompt is empty.')

    const activeContents = this.tabs?.getActiveWebContents?.()
    const pageContext = activeContents
      ? await this._getPageContext(activeContents)
      : { title: '', url: '', selection: '', content: '' }

    const answer = await this.askWithCustomProvider(prompt, this.sessionId, pageContext.content, uid)
    return {
      answer,
      provider: 'custom',
      model: 'N/A'
    }
  }

  async askWithCustomProvider(userPrompt, session_id, pageContent, uid = '') {
    const response = await generateCustomChatResponse(userPrompt, uid, session_id, pageContent)

    if (response?.session_id) {
      this.sessionId = response.session_id
    }

    return response?.answer || ''
  }

  resetSession() {
    this.sessionId = ''
  }

  async _getPageContext(webContents) {
    const context = await webContents.executeJavaScript(`(() => {
      const title = document.title || ''
      const url = window.location.href || ''
      const selection = window.getSelection ? String(window.getSelection()) : ''
      const bodyText = document.body ? (document.body.innerText || '') : ''
      return {
        title,
        url,
        selection: selection.slice(0, 1200),
        content: bodyText.slice(0, 12000)
      }
    })()`)

    return context || { title: '', url: '', selection: '', content: '' }
  }
}

module.exports = { AskAiService }
