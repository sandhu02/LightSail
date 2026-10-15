import {
  getDefaultModel,
  getModelOptions,
  hasSavedKey,
  getDefaultVoiceModel,
  getVoiceModelOptions,
  hasSavedVoiceKey
} from './aiConfig.js'

function setStatus(state, message, tone = 'info') {
  state.ai.statusMessage = message
  state.ai.statusTone = tone
}

function setVoiceStatus(state, message, tone = 'info') {
  state.voice = state.voice || {}
  state.voice.statusMessage = message
  state.voice.statusTone = tone
}

function syncModelSuggestions(state) {
  const datalist = document.getElementById('ai-model-suggestions')
  if (!datalist) return

  const models = getModelOptions(state.ai, state.ai.provider)
  datalist.innerHTML = models.map(model => `<option value="${model}"></option>`).join('')
}

function syncVoiceModelSuggestions(state) {
  const datalist = document.getElementById('voice-model-suggestions')
  if (!datalist) return

  const models = getVoiceModelOptions(state.voice, state.voice?.provider)
  datalist.innerHTML = models.map(model => `<option value="${model}"></option>`).join('')
}

function updateKeyStatusChip(state) {
  const chip = document.getElementById('ai-key-status-chip')
  if (!chip) return

  const isConfigured = hasSavedKey(state.ai, state.ai.provider)
  chip.textContent = isConfigured ? 'Configured' : 'Not set'
  chip.dataset.status = isConfigured ? 'configured' : 'missing'
}

function updateVoiceKeyStatusChip(state) {
  const chip = document.getElementById('voice-key-status-chip')
  if (!chip) return

  const isConfigured = hasSavedVoiceKey(state.voice, state.voice?.provider)
  chip.textContent = isConfigured ? 'Configured' : 'Not set'
  chip.dataset.status = isConfigured ? 'configured' : 'missing'
}

function syncProviderUi(state) {
  const modelInput = document.getElementById('ai-model-input')
  if (modelInput && !modelInput.value.trim()) {
    modelInput.value = getDefaultModel(state.ai, state.ai.provider)
  }

  syncModelSuggestions(state)
  updateKeyStatusChip(state)
}

function syncVoiceProviderUi(state) {
  const modelInput = document.getElementById('voice-model-input')
  if (modelInput && !modelInput.value.trim()) {
    modelInput.value = getDefaultVoiceModel(state.voice, state.voice?.provider)
  }

  syncVoiceModelSuggestions(state)
  updateVoiceKeyStatusChip(state)
}

function setSavingState(state, isSaving) {
  state.ai.isSaving = isSaving

  const saveBtn = document.getElementById('ai-settings-save-btn')
  const clearKeyBtn = document.getElementById('ai-settings-clear-key-btn')

  if (saveBtn) {
    saveBtn.disabled = isSaving
    saveBtn.textContent = isSaving ? 'Saving...' : 'Save'
  }

  if (clearKeyBtn) {
    clearKeyBtn.disabled = isSaving || !hasSavedKey(state.ai, state.ai.provider)
  }
}

function setVoiceSavingState(state, isSaving) {
  state.voice = state.voice || {}
  state.voice.isSaving = isSaving

  const saveBtn = document.getElementById('voice-settings-save-btn')
  const clearKeyBtn = document.getElementById('voice-settings-clear-key-btn')

  if (saveBtn) {
    saveBtn.disabled = isSaving
    saveBtn.textContent = isSaving ? 'Saving...' : 'Save Voice'
  }

  if (clearKeyBtn) {
    clearKeyBtn.disabled = isSaving || !hasSavedVoiceKey(state.voice, state.voice?.provider)
  }
}

function renderStatusBanner(state) {
  const statusEl = document.getElementById('ai-settings-status')
  if (!statusEl) return

  if (!state.ai.statusMessage) {
    statusEl.hidden = true
    statusEl.textContent = ''
    statusEl.dataset.tone = 'info'
    return
  }

  statusEl.hidden = false
  statusEl.textContent = state.ai.statusMessage
  statusEl.dataset.tone = state.ai.statusTone || 'info'
}

function renderVoiceStatusBanner(state) {
  const statusEl = document.getElementById('voice-settings-status')
  if (!statusEl) return

  if (!state.voice?.statusMessage) {
    statusEl.hidden = true
    statusEl.textContent = ''
    statusEl.dataset.tone = 'info'
    return
  }

  statusEl.hidden = false
  statusEl.textContent = state.voice.statusMessage
  statusEl.dataset.tone = state.voice.statusTone || 'info'
}

function applyRendererSnapshot(state, snapshot) {
  state.ai.provider = snapshot.provider || state.ai.provider
  state.ai.model = snapshot.model || state.ai.model
  state.ai.providers = Array.isArray(snapshot.providers) ? snapshot.providers : state.ai.providers
  state.ai.keyStatus = snapshot.keyStatus || {}

  if (snapshot.voice) {
    state.voice = state.voice || {}
    state.voice.provider = snapshot.voice.provider || state.voice.provider || 'gemini'
    state.voice.model = snapshot.voice.model || state.voice.model || 'gemini-3.5-transcribe'
    state.voice.providers = Array.isArray(snapshot.voice.providers) ? snapshot.voice.providers : (state.voice.providers || [])
    state.voice.keyStatus = snapshot.voice.keyStatus || {}
  }
}

async function saveAiSettings(state) {
  const providerSelect = document.getElementById('ai-provider-select')
  const modelInput = document.getElementById('ai-model-input')
  const apiKeyInput = document.getElementById('ai-api-key-input')
  if (!providerSelect || !modelInput || !apiKeyInput) return

  const provider = providerSelect.value
  const model = modelInput.value.trim() || getDefaultModel(state.ai, provider)
  const apiKey = apiKeyInput.value.trim()

  setSavingState(state, true)
  setStatus(state, '')
  renderStatusBanner(state)

  try {
    const settingsSnapshot = await window.aiSettings.update({ provider, model })
    applyRendererSnapshot(state, settingsSnapshot)

    if (apiKey) {
      const keysSnapshot = await window.aiSettings.setApiKey(provider, apiKey)
      applyRendererSnapshot(state, keysSnapshot)
      apiKeyInput.value = ''
      setStatus(state, 'Provider, model, and API key saved.', 'success')
    } else {
      setStatus(state, 'Provider and model saved.', 'success')
    }

    state.ai.model = model
    syncProviderUi(state)
  } catch (error) {
    setStatus(state, error.message || 'Unable to save AI settings.', 'error')
  } finally {
    renderStatusBanner(state)
    setSavingState(state, false)
  }
}

async function clearProviderKey(state) {
  setSavingState(state, true)
  setStatus(state, '')
  renderStatusBanner(state)

  try {
    const snapshot = await window.aiSettings.clearApiKey(state.ai.provider)
    applyRendererSnapshot(state, snapshot)
    setStatus(state, 'Saved API key removed for this provider.', 'success')
    updateKeyStatusChip(state)
  } catch (error) {
    setStatus(state, error.message || 'Unable to clear the API key.', 'error')
  } finally {
    renderStatusBanner(state)
    setSavingState(state, false)
  }
}

async function saveVoiceSettings(state) {
  const providerSelect = document.getElementById('voice-provider-select')
  const modelInput = document.getElementById('voice-model-input')
  const apiKeyInput = document.getElementById('voice-api-key-input')
  if (!providerSelect || !modelInput || !apiKeyInput) return

  const provider = providerSelect.value
  const model = modelInput.value.trim() || getDefaultVoiceModel(state.voice, provider)
  const apiKey = apiKeyInput.value.trim()

  setVoiceSavingState(state, true)
  setVoiceStatus(state, '')
  renderVoiceStatusBanner(state)

  try {
    const settingsSnapshot = await window.aiSettings.updateVoiceSettings({ provider, model })
    applyRendererSnapshot(state, settingsSnapshot)

    if (apiKey) {
      const keysSnapshot = await window.aiSettings.setVoiceApiKey(provider, apiKey)
      applyRendererSnapshot(state, keysSnapshot)
      apiKeyInput.value = ''
      setVoiceStatus(state, 'Voice provider, model, and API key saved.', 'success')
    } else {
      setVoiceStatus(state, 'Voice provider and model saved.', 'success')
    }

    state.voice.model = model
    syncVoiceProviderUi(state)
  } catch (error) {
    setVoiceStatus(state, error.message || 'Unable to save voice settings.', 'error')
  } finally {
    renderVoiceStatusBanner(state)
    setVoiceSavingState(state, false)
  }
}

async function clearVoiceKey(state) {
  setVoiceSavingState(state, true)
  setVoiceStatus(state, '')
  renderVoiceStatusBanner(state)

  try {
    const snapshot = await window.aiSettings.clearVoiceApiKey(state.voice.provider)
    applyRendererSnapshot(state, snapshot)
    setVoiceStatus(state, 'Saved API key removed for this voice provider.', 'success')
    updateVoiceKeyStatusChip(state)
  } catch (error) {
    setVoiceStatus(state, error.message || 'Unable to clear voice API key.', 'error')
  } finally {
    renderVoiceStatusBanner(state)
    setVoiceSavingState(state, false)
  }
}

export async function hydrateAiSettingsState(state) {
  if (!window.aiSettings?.get) return

  try {
    const snapshot = await window.aiSettings.get()
    applyRendererSnapshot(state, snapshot)
  } catch (error) {
    setStatus(state, error.message || 'Unable to load AI settings.', 'error')
  }
}

export function bindAiSettingsSection(state) {
  const providerSelect = document.getElementById('ai-provider-select')
  const modelInput = document.getElementById('ai-model-input')
  const saveBtn = document.getElementById('ai-settings-save-btn')
  const clearKeyBtn = document.getElementById('ai-settings-clear-key-btn')
  if (!providerSelect || !modelInput || !saveBtn || !clearKeyBtn) return

  providerSelect.addEventListener('change', () => {
    state.ai.provider = providerSelect.value

    if (!modelInput.value.trim()) {
      const fallbackModel = getDefaultModel(state.ai, state.ai.provider)
      state.ai.model = fallbackModel
      modelInput.value = fallbackModel
    }

    syncProviderUi(state)
    renderStatusBanner(state)
    setSavingState(state, false)
  })

  modelInput.addEventListener('input', () => {
    state.ai.model = modelInput.value
  })

  saveBtn.addEventListener('click', () => {
    saveAiSettings(state)
  })

  clearKeyBtn.addEventListener('click', () => {
    clearProviderKey(state)
  })

  syncModelSuggestions(state)
  updateKeyStatusChip(state)
  renderStatusBanner(state)
  setSavingState(state, state.ai.isSaving)
}

export function bindVoiceSettingsSection(state) {
  const providerSelect = document.getElementById('voice-provider-select')
  const modelInput = document.getElementById('voice-model-input')
  const saveBtn = document.getElementById('voice-settings-save-btn')
  const clearKeyBtn = document.getElementById('voice-settings-clear-key-btn')
  if (!providerSelect || !modelInput || !saveBtn || !clearKeyBtn) return

  providerSelect.addEventListener('change', () => {
    state.voice.provider = providerSelect.value

    const availableModels = getVoiceModelOptions(state.voice, state.voice.provider)
    if (!modelInput.value.trim() || (availableModels.length && !availableModels.includes(modelInput.value.trim()))) {
      const fallbackModel = getDefaultVoiceModel(state.voice, state.voice.provider)
      state.voice.model = fallbackModel
      modelInput.value = fallbackModel
    }

    syncVoiceProviderUi(state)
    renderVoiceStatusBanner(state)
    setVoiceSavingState(state, false)
  })

  modelInput.addEventListener('input', () => {
    state.voice.model = modelInput.value
  })

  saveBtn.addEventListener('click', () => {
    saveVoiceSettings(state)
  })

  clearKeyBtn.addEventListener('click', () => {
    clearVoiceKey(state)
  })

  syncVoiceModelSuggestions(state)
  updateVoiceKeyStatusChip(state)
  renderVoiceStatusBanner(state)
  setVoiceSavingState(state, state.voice?.isSaving)
}
