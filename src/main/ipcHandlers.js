const { ipcMain, BrowserWindow } = require('electron')
const { AISettingsService } = require('./ai/settings/aiSettingsService')
const { AskAiService } = require('./ai/features/ask_ai/askAiService')

function registerIpcHandlers(tabs, downloads) {
  const aiSettingsService = new AISettingsService()
  const askAiService = new AskAiService(tabs, aiSettingsService)

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
  ipcMain.on('layout:update', (_, layout) => tabs.updateLayout(layout))

  ipcMain.handle('ai:ask', async (_, prompt) => askAiService.ask(prompt))
  ipcMain.handle('ai:settings:get', () => aiSettingsService.getSettingsForRenderer())
  ipcMain.handle('ai:settings:update', (_, settings) => aiSettingsService.updateSettings(settings))
  ipcMain.handle('ai:key:set', (_, { provider, apiKey }) => aiSettingsService.setApiKey(provider, apiKey))
  ipcMain.handle('ai:key:clear', (_, provider) => aiSettingsService.clearApiKey(provider))

  ipcMain.handle('main:browsingHistory', () => tabs.getBrowsingHistory())

  // Download handlers
  ipcMain.handle('downloads:getHistory', () => downloads.getHistory())
  ipcMain.handle('downloads:getActive', () => downloads.getActiveDownloads())
  ipcMain.handle('downloads:clearHistory', () => downloads.clearHistory())
  ipcMain.on('downloads:showFile', (_, filePath) => downloads.showFileInFolder(filePath))
  ipcMain.on('downloads:pause', (_, downloadId) => downloads.pauseDownload(downloadId))
  ipcMain.on('downloads:resume', (_, downloadId) => downloads.resumeDownload(downloadId))
  ipcMain.on('downloads:cancel', (_, downloadId) => downloads.cancelDownload(downloadId))

  ipcMain.on('auth:start', (event) => {
    const authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    authWindow.loadURL('http://13.48.28.103.nip.io:8080/auth/google/')

    authWindow.once('ready-to-show', () => {
      authWindow.show()
    })

    authWindow.webContents.on('dom-ready', async () => {
      try {
        const content = await authWindow.webContents.executeJavaScript('document.body.textContent')
        if (content.trim().startsWith('{')) {
          const data = JSON.parse(content)
          if (data.message === 'User authenticated successfully') {
            event.sender.send('auth:success', data)
            authWindow.close()
          } else {
            event.sender.send('auth:error', data.message || 'Authentication failed')
            authWindow.close()
          }
        }
      } catch (e) {
        // Ignore if not JSON yet
      }
    })

    authWindow.on('closed', () => {
      // If not handled, perhaps send error
    })
  })
}

module.exports = { registerIpcHandlers }