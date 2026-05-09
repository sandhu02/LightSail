const { contextBridge, ipcRenderer } = require('electron')

function isInternalPage() {
  try {
    return window.location.protocol === 'file:'
  } catch (_) {
    return false
  }
}

contextBridge.exposeInMainWorld('aiSettings', {
  get: () => {
    if (!isInternalPage()) throw new Error('AI settings are available only on internal pages.')
    return ipcRenderer.invoke('ai:settings:get')
  },
  update: (settings) => {
    if (!isInternalPage()) throw new Error('AI settings are available only on internal pages.')
    return ipcRenderer.invoke('ai:settings:update', settings)
  },
  setApiKey: (provider, apiKey) => {
    if (!isInternalPage()) throw new Error('AI settings are available only on internal pages.')
    return ipcRenderer.invoke('ai:key:set', { provider, apiKey })
  },
  clearApiKey: (provider) => {
    if (!isInternalPage()) throw new Error('AI settings are available only on internal pages.')
    return ipcRenderer.invoke('ai:key:clear', provider)
  }
})

contextBridge.exposeInMainWorld('internal', {
  getBrowsingHistory: () => ipcRenderer.invoke('main:browsingHistory')
})