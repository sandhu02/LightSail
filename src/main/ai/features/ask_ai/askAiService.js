const { generateLLMResponse } = require('../../core/llmGateway')
const { generateCustomChatResponse} = require('../../core/customChatGateway')

class AskAiService {
  constructor(tabs, aiSettingsService) {
    this.tabs = tabs
    this.aiSettingsService = aiSettingsService

    this.sessionId = ''
  }

  async ask(prompt, uid = '') {
    if (!prompt || !prompt.trim()) throw new Error('Prompt is empty.')

    const activeContents = this.tabs.getActiveWebContents()
    if (!activeContents) throw new Error('No active tab found.')

    const pageContext = await this._getPageContext(activeContents)
    const settings = await this.aiSettingsService.getExecutionSettings()

    const systemPrompt = [
      'You are a browser assistant.',
      'Answer only using the current page context and user question.',
      'If context is insufficient, state uncertainty clearly.',
      'Keep answer concise and practical.'
    ].join(' ')

    const userPrompt = [
      `Current page title: ${pageContext.title || 'Unknown'}`,
      `Current page URL: ${pageContext.url || 'Unknown'}`,
      `Selected text: ${pageContext.selection || 'None'}`,
      'Visible page text snippet:',
      pageContext.content || 'No content available.',
      '',
      `User question: ${prompt}`
    ].join('\n')


    if (settings.provider === 'custom') {

      const answer = await this.askWithCustomProvider(prompt, this.sessionId, pageContext.content, uid)
      return {
        answer,
        provider: 'custom',
        model: 'N/A'
      }
    }
    else {
      const answer = await generateLLMResponse({ settings, systemPrompt, userPrompt })
      return {
        answer,
        provider: settings.provider,
        model: settings.model
      }
    }
  }

  async askWithCustomProvider(userPrompt, session_id, pageContent, uid = '' ) {
    const response = await generateCustomChatResponse(userPrompt, uid, session_id, pageContent )

    session_id = response.session_id || session_id

    return response.answer
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
