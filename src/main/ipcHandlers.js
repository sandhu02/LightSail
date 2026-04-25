const { ipcMain } = require('electron')

function registerIpcHandlers(tabs) {
  ipcMain.on('tab:create', (_, url) => tabs.createTab(url))
  ipcMain.on('tab:switch', (_, id) => tabs.switchTab(id))
  ipcMain.on('tab:close', (_, id) => tabs.closeTab(id))
  
  ipcMain.on('tab:navigate', (_, { id, url }) => {
    tabs.tabs.get(id)?.view.webContents.loadURL(url)
  })

  ipcMain.on('tab:back', (_, id) => {
    const view = tabs.tabs.get(id)?.view
    if (view?.webContents.canGoBack()) view.webContents.goBack()
  })
  
  ipcMain.on('tab:forward', (_, id) => {
    const view = tabs.tabs.get(id)?.view
    if (view?.webContents.canGoForward()) view.webContents.goForward()
  })
  
  ipcMain.on('tab:reload', (_, id) => tabs.tabs.get(id)?.view.webContents.reload())
}

module.exports = { registerIpcHandlers }