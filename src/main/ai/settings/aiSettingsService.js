const { AISettingsStore } = require('./aiSettingsStore')
const { AISecretsStore } = require('./aiSecretsStore')
const { getProviderSummaries } = require('./aiCatalog')

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

    return {
      ...settings,
      providers: getProviderSummaries(),
      keyStatus
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

  async getExecutionSettings() {
    const settings = this.settingsStore.getSettings()
    const apiKey = await this.secretsStore.getApiKey(settings.provider)

    return {
      ...settings,
      apiKey
    }
  }
}

module.exports = { AISettingsService }
