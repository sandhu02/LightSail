const Store = require('electron-store').default
const { DEFAULT_AI_SETTINGS, DEFAULT_VOICE_SETTINGS, getProviderConfig, getVoiceProviderConfig } = require('./aiCatalog')

class AISettingsStore {
  constructor() {
    this.store = new Store({
      name: 'ai-settings',
      defaults: {
        ...DEFAULT_AI_SETTINGS,
        voice_provider: DEFAULT_VOICE_SETTINGS.provider,
        voice_model: DEFAULT_VOICE_SETTINGS.model
      }
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

  getVoiceSettings() {
    const rawProvider = this.store.get('voice_provider') || DEFAULT_VOICE_SETTINGS.provider
    const provider = rawProvider === 'openai' ? 'openai' : 'gemini'
    const defaultModel = getVoiceProviderConfig(provider).defaultModel
    const storedModel = this.store.get(`voice_model_${provider}`) || this.store.get('voice_model') || defaultModel

    return {
      provider,
      model: storedModel
    }
  }

  updateVoiceSettings(partialSettings = {}) {
    const current = this.getVoiceSettings()
    const rawProvider = partialSettings.provider ?? current.provider
    const provider = rawProvider === 'openai' ? 'openai' : 'gemini'
    const defaultModel = getVoiceProviderConfig(provider).defaultModel
    const rawModel = partialSettings.model !== undefined ? partialSettings.model : current.model
    const model = String(rawModel || '').trim() || defaultModel

    this.store.set('voice_provider', provider)
    this.store.set('voice_model', model)
    this.store.set(`voice_model_${provider}`, model)

    return { provider, model }
  }

  _normalizeProvider(provider) {
    return getProviderConfig(provider).id
  }

  _normalizeModel(provider, model) {
    const normalizedModel = String(model || '').trim()
    return normalizedModel || getProviderConfig(provider).defaultModel
  }
}

module.exports = { AISettingsStore, DEFAULT_AI_SETTINGS, DEFAULT_VOICE_SETTINGS }

