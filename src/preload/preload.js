// preload.js
const { contextBridge, ipcRenderer } = require('electron')
// const { addressBarSearchAlgorithm } = require('../utils/address_bar_search_algorithms')

// Algorithm function (can be imported from a file if needed)
function addressBarSearchAlgorithm(url) {
  if (!url.startsWith('http') && !url.startsWith('https:')) {
    if (url.includes('.')) {
      return 'https://' + url
    }
    return 'https://www.google.com/search?q=' + encodeURIComponent(url)
  }
  return url
}

contextBridge.exposeInMainWorld('tabs', {
  create:   (url)      => ipcRenderer.send('tab:create', url),
  close:    (id)       => ipcRenderer.send('tab:close', id),
  switch:   (id)       => ipcRenderer.send('tab:switch', id),
  navigate: (id, url)  => ipcRenderer.send('tab:navigate', { id, url }),
  back:     (id)       => ipcRenderer.send('tab:back', id),
  forward:  (id)       => ipcRenderer.send('tab:forward', id),
  reload:   (id)       => ipcRenderer.send('tab:reload', id),
  updateLayout: (layout) => ipcRenderer.send('layout:update', layout),
  on: (event, cb)      => ipcRenderer.on(event, (_, data) => cb(data)),
  addressBarSearch:   (url)       => addressBarSearchAlgorithm(url)
})

contextBridge.exposeInMainWorld('ai', {
  ask: (prompt) => ipcRenderer.invoke('ai:ask', prompt),
  getSettings: () => ipcRenderer.invoke('ai:settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('ai:settings:update', settings),
  setApiKey: (provider, apiKey) => ipcRenderer.invoke('ai:key:set', { provider, apiKey }),
  clearApiKey: (provider) => ipcRenderer.invoke('ai:key:clear', provider)
})

