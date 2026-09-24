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
    const storedModel = this.store.get(`model_${provider}`) || this.store.get('model')
    const model = this._normalizeModel(provider, storedModel)

    return { provider, model }
  }

  updateSettings(partialSettings = {}) {
    const current = this.getSettings()
    const provider = this._normalizeProvider(partialSettings.provider ?? current.provider)
    const rawModel = partialSettings.model !== undefined ? partialSettings.model : current.model
    const model = this._normalizeModel(provider, rawModel)
    const next = {
      provider,
      model
    }

    this.store.set(next)
    if (model) {
      this.store.set(`model_${provider}`, model)
    }
    return next
  }

  getModelForProvider(provider) {
    const normalizedProvider = this._normalizeProvider(provider)
    const stored = this.store.get(`model_${normalizedProvider}`) || this.store.get('model')
    return this._normalizeModel(normalizedProvider, stored)
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
