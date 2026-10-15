const { AISettingsStore } = require('./aiSettingsStore')
const { AISecretsStore } = require('./aiSecretsStore')
const { getProviderSummaries, getVoiceProviderSummaries } = require('./aiCatalog')

class AISettingsService {
  constructor({
    settingsStore = new AISettingsStore(),
    secretsStore = new AISecretsStore()
  } = {}) {
    this.settingsStore = settingsStore
    this.secretsStore = secretsStore
  }

  async getSettingsForRenderer() {
    const settings = this.settingsStore.getSettings()
    const keyStatus = await this.secretsStore.getKeyStatusMap()
    const voiceSettings = this.settingsStore.getVoiceSettings()
    const voiceKeyStatus = await this.secretsStore.getVoiceKeyStatusMap()

    return {
      ...settings,
      providers: getProviderSummaries(),
      keyStatus,
      voice: {
        ...voiceSettings,
        providers: getVoiceProviderSummaries(),
        keyStatus: voiceKeyStatus
      }
    }
  }

  async updateSettings(partialSettings = {}) {
    this.settingsStore.updateSettings(partialSettings)
    return this.getSettingsForRenderer()
  }

  async setApiKey(provider, apiKey) {
    await this.secretsStore.setApiKey(provider, apiKey)
    return this.getSettingsForRenderer()
  }

  async clearApiKey(provider) {
    await this.secretsStore.clearApiKey(provider)
    return this.getSettingsForRenderer()
  }

  async updateVoiceSettings(partialSettings = {}) {
    this.settingsStore.updateVoiceSettings(partialSettings)
    return this.getSettingsForRenderer()
  }

  async setVoiceApiKey(provider, apiKey) {
    await this.secretsStore.setVoiceApiKey(provider, apiKey)
    return this.getSettingsForRenderer()
  }

  async clearVoiceApiKey(provider) {
    await this.secretsStore.clearVoiceApiKey(provider)
    return this.getSettingsForRenderer()
  }

  async getExecutionSettings() {
    const settings = this.settingsStore.getSettings()
    const apiKey = await this.secretsStore.getApiKey(settings.provider)

    return {
      ...settings,
      apiKey
    }
  }

  async getVoiceExecutionSettings() {
    const voiceSettings = this.settingsStore.getVoiceSettings()
    let apiKey = await this.secretsStore.getVoiceApiKey(voiceSettings.provider)
    if (!apiKey) {
      // Fallback to same-provider general key if available
      apiKey = await this.secretsStore.getApiKey(voiceSettings.provider)
    }

    return {
      ...voiceSettings,
      apiKey: apiKey || ''
    }
  }
}

module.exports = { AISettingsService }

