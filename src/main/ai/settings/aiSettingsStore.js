const Store = require('electron-store').default
const { DEFAULT_AI_SETTINGS, getProviderConfig } = require('./aiCatalog')

class AISettingsStore {
  constructor() {
    this.store = new Store({
      name: 'ai-settings',
      defaults: DEFAULT_AI_SETTINGS
    })
  }

  getSettings() {
    const provider = this._normalizeProvider(this.store.get('provider'))
    const model = this._normalizeModel(provider, this.store.get('model'))

    return { provider, model }
  }

  updateSettings(partialSettings = {}) {
    const current = this.getSettings()
    const provider = this._normalizeProvider(partialSettings.provider ?? current.provider)
    const model = this._normalizeModel(provider, partialSettings.model ?? current.model)
    const next = {
      provider,
      model
    }

    this.store.set(next)
    return next
  }

  _normalizeProvider(provider) {
    return getProviderConfig(provider).id
  }

  _normalizeModel(provider, model) {
    const normalizedModel = String(model || '').trim()
    return normalizedModel || getProviderConfig(provider).defaultModel
  }
}

module.exports = { AISettingsStore, DEFAULT_AI_SETTINGS }
