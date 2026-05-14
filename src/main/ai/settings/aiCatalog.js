const AI_PROVIDER_CATALOG = {
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ]
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4.1-mini',
    models: [
      'gpt-4.1-mini',
      'gpt-4.1',
      'gpt-4o-mini',
      'gpt-4o'
    ]
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    defaultModel: '',
    models: []
  }

}

const DEFAULT_PROVIDER_ID = 'gemini'

const DEFAULT_AI_SETTINGS = {
  provider: DEFAULT_PROVIDER_ID,
  model: AI_PROVIDER_CATALOG[DEFAULT_PROVIDER_ID].defaultModel
}

function getProviderConfig(providerId) {
  return AI_PROVIDER_CATALOG[providerId] || AI_PROVIDER_CATALOG[DEFAULT_PROVIDER_ID]
}

function getProviderSummaries() {
  return Object.values(AI_PROVIDER_CATALOG).map(provider => ({
    id: provider.id,
    label: provider.label,
    defaultModel: provider.defaultModel,
    models: [...provider.models]
  }))
}

module.exports = {
  AI_PROVIDER_CATALOG,
  DEFAULT_AI_SETTINGS,
  DEFAULT_PROVIDER_ID,
  getProviderConfig,
  getProviderSummaries
}
