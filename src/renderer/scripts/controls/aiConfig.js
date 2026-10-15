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

export function getVoiceProviderOptions(voiceState) {
  return Array.isArray(voiceState?.providers) ? voiceState.providers : []
}

export function getVoiceProviderById(voiceState, providerId) {
  return getVoiceProviderOptions(voiceState).find(provider => provider.id === providerId) || getVoiceProviderOptions(voiceState)[0] || null
}

export function getVoiceModelOptions(voiceState, providerId) {
  return getVoiceProviderById(voiceState, providerId)?.models || []
}

export function getDefaultVoiceModel(voiceState, providerId) {
  return getVoiceProviderById(voiceState, providerId)?.defaultModel || (providerId === 'openai' ? 'whisper-1' : 'gemini-3.5-transcribe')
}

export function hasSavedVoiceKey(voiceState, providerId) {
  return Boolean(voiceState?.keyStatus?.[providerId])
}

