const keytar = require('keytar')
const { app } = require('electron')
const { AI_PROVIDER_CATALOG } = require('./aiCatalog')

class AISecretsStore {
  constructor() {
    this.serviceName = `${app.getName()}-ai`
  }

  async getApiKey(provider) {
    if (!AI_PROVIDER_CATALOG[provider]) return ''
    try {
      const stored = await keytar.getPassword(this.serviceName, provider)
      if (stored) return stored
    } catch (e) {
      // Keytar read error fallback
      console.log("Key tar error: " + e)
    }
  }

  async setApiKey(provider, apiKey) {
    if (!AI_PROVIDER_CATALOG[provider]) {
      throw new Error(`Unsupported AI provider: ${provider}`)
    }

    const normalizedKey = String(apiKey || '').trim()
    if (!normalizedKey) {
      throw new Error('API key is empty.')
    }

    await keytar.setPassword(this.serviceName, provider, normalizedKey)
    return true
  }

  async clearApiKey(provider) {
    if (!AI_PROVIDER_CATALOG[provider]) return false
    return keytar.deletePassword(this.serviceName, provider)
  }

  async getKeyStatusMap() {
    const entries = await Promise.all(
      Object.keys(AI_PROVIDER_CATALOG).map(async provider => [provider, Boolean(await this.getApiKey(provider))])
    )

    return Object.fromEntries(entries)
  }

  async getVoiceApiKey(provider = 'gemini') {
    const normalizedProvider = provider === 'openai' ? 'openai' : 'gemini'
    try {
      const stored = await keytar.getPassword(this.serviceName, `voice_${normalizedProvider}`)
      if (stored) return stored
    } catch (e) {
      console.log('Voice keytar read error: ' + e)
    }
    return ''
  }

  async setVoiceApiKey(provider, apiKey) {
    const normalizedProvider = provider === 'openai' ? 'openai' : 'gemini'
    const normalizedKey = String(apiKey || '').trim()
    if (!normalizedKey) {
      throw new Error('Voice API key is empty.')
    }

    await keytar.setPassword(this.serviceName, `voice_${normalizedProvider}`, normalizedKey)
    return true
  }

  async clearVoiceApiKey(provider) {
    const normalizedProvider = provider === 'openai' ? 'openai' : 'gemini'
    return keytar.deletePassword(this.serviceName, `voice_${normalizedProvider}`)
  }

  async getVoiceKeyStatusMap() {
    const providers = ['gemini', 'openai']
    const entries = await Promise.all(
      providers.map(async p => [p, Boolean(await this.getVoiceApiKey(p))])
    )

    return Object.fromEntries(entries)
  }
}

module.exports = { AISecretsStore }

