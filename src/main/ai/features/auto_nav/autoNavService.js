/**
 * Auto-Navigation Service (Main Process IPC entry point).
 * Manages the lifecycle of autonomous navigation sessions.
 */

const { AgentOrchestrator } = require('./agentOrchestrator')

class AutoNavService {
  /**
   * @param {import('../../TabsManager')} tabs
   * @param {import('../../settings/aiSettingsService').AISettingsService} aiSettingsService
   * @param {Electron.BrowserWindow} win
   */
  constructor(tabs, aiSettingsService, win) {
    this.tabs = tabs
    this.aiSettingsService = aiSettingsService
    this.win = win
    this.currentOrchestrator = null
    this.isRunning = false
  }

  async _getAutoNavSettings() {
    const settings = await this.aiSettingsService.getExecutionSettings()

    if (settings.provider === 'openai' || settings.provider === 'gemini') {
      if (!settings.apiKey) {
        const providerName = settings.provider === 'openai' ? 'OpenAI' : 'Gemini'
        throw new Error(`${providerName} API key is missing. Please set your ${providerName} API key in Controls > AI Settings.`)
      }
      return settings
    }

    // When global provider is 'custom' (used for custom university Ask AI server):
    // Check if user has an existing Gemini or OpenAI API key saved in secrets
    const geminiKey = await this.aiSettingsService.secretsStore.getApiKey('gemini')
    if (geminiKey) {
      const geminiModel = this.aiSettingsService.settingsStore?.getModelForProvider?.('gemini')
        || settings.model
        || 'gemini-2.5-flash'
      return {
        provider: 'gemini',
        model: geminiModel,
        apiKey: geminiKey
      }
    }

    const openaiKey = await this.aiSettingsService.secretsStore.getApiKey('openai')
    if (openaiKey) {
      const openaiModel = this.aiSettingsService.settingsStore?.getModelForProvider?.('openai')
        || settings.model
        || 'gpt-4.1-mini'
      return {
        provider: 'openai',
        model: openaiModel,
        apiKey: openaiKey
      }
    }

    throw new Error(
      'Auto-Navigation requires an AI provider with tool/function calling support (Gemini or OpenAI). The "custom" provider only supports Ask AI chat. Please switch provider to Gemini or OpenAI and enter an API key in Controls > AI Settings.'
    )
  }

  /**
   * Starts an autonomous navigation session with the given prompt.
   *
   * @param {string} prompt - Natural language goal
   * @returns {Promise<import('./autoNavTypes').AgentResult>}
   */
  async start(prompt) {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Please enter a goal or task to perform.')
    }

    if (this.isRunning) {
      throw new Error('An agent is already running. Stop it first.')
    }

    const activeWebContents = this.tabs.getActiveWebContents()
    if (!activeWebContents) {
      throw new Error('No active browser tab found.')
    }

    // Resolve compatible AI execution settings
    const executionSettings = await this._getAutoNavSettings()

    this.isRunning = true

    const orchestrator = new AgentOrchestrator({
      tabs: this.tabs,
      aiSettingsService: this.aiSettingsService,
      executionSettings,
      onStepUpdate: (stepData) => {
        this._send('agent:step', stepData)
      },
      onStatusChange: (statusData) => {
        this._send('agent:status', statusData)
      }
    })


    this.currentOrchestrator = orchestrator

    try {
      return await orchestrator.run(prompt.trim())
    } finally {
      this.isRunning = false
      this.currentOrchestrator = null
    }
  }

  /**
   * Stops any currently running agent session.
   */
  stop() {
    if (this.currentOrchestrator) {
      this.currentOrchestrator.stop()
    }
  }

  _send(channel, data) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(channel, data)
    }
  }
}

module.exports = { AutoNavService }
