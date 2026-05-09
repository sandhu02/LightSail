export function getProviderOptions(aiState) {
  return Array.isArray(aiState.providers) ? aiState.providers : []
}

export function getProviderById(aiState, providerId) {
  return getProviderOptions(aiState).find(provider => provider.id === providerId) || getProviderOptions(aiState)[0] || null
}

export function getModelOptions(aiState, providerId) {
  return getProviderById(aiState, providerId)?.models || []
}

export function getDefaultModel(aiState, providerId) {
  return getProviderById(aiState, providerId)?.defaultModel || ''
}

export function hasSavedKey(aiState, providerId) {
  return Boolean(aiState.keyStatus?.[providerId])
}
