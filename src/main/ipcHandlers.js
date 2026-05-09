const { ipcMain } = require('electron')
const { AISettingsService } = require('./ai/settings/aiSettingsService')
const { AskAiService } = require('./ai/features/ask_ai/askAiService')

function registerIpcHandlers(tabs) {
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
  
}

module.exports = { registerIpcHandlers }