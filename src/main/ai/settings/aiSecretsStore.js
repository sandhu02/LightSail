const keytar = require('keytar')
const { app } = require('electron')
const { AI_PROVIDER_CATALOG } = require('./aiCatalog')

class AISecretsStore {
  constructor() {
    this.serviceName = `${app.getName()}-ai`
  }

  async getApiKey(provider) {
    if (!AI_PROVIDER_CATALOG[provider]) return ''
    return (await keytar.getPassword(this.serviceName, provider)) || ''
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
}

module.exports = { AISecretsStore }
