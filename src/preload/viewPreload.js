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

contextBridge.exposeInMainWorld('downloads', {
  getHistory: () => ipcRenderer.invoke('downloads:getHistory'),
  getActive: () => ipcRenderer.invoke('downloads:getActive'),
  clearHistory: () => ipcRenderer.invoke('downloads:clearHistory'),
  showFile: (filePath) => ipcRenderer.send('downloads:showFile', filePath),
  pause: (downloadId) => ipcRenderer.send('downloads:pause', downloadId),
  resume: (downloadId) => ipcRenderer.send('downloads:resume', downloadId),
  cancel: (downloadId) => ipcRenderer.send('downloads:cancel', downloadId)
})

contextBridge.exposeInMainWorld('auth', {
  start: () => ipcRenderer.send('auth:start'),
  on: (event, cb) => ipcRenderer.on(`auth:${event}`, (_, data) => cb(data))
})

contextBridge.exposeInMainWorld('electronAPI', {
  on: (channel, callback) => {
    const validChannels = ['download:started', 'download:progress', 'download:finished', 'download:indicator']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args))
    }
  },
  off: (channel, callback) => {
    const validChannels = ['download:started', 'download:progress', 'download:finished', 'download:indicator']
    if (validChannels.includes(channel)) {
      ipcRenderer.off(channel, callback)
    }
  }
})