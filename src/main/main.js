// main.js
const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const TabManager = require('./TabsManager')
const { DownloadManager } = require('./DownloadManager')
const { registerIpcHandlers } = require('./ipcHandlers')
const { applicationMenuFunction } = require('./menus/applicationMenu')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200, height: 800,
    icon: path.join(__dirname, '../../assets/images/light_sail_logo.jpeg'),
    webPreferences: { 
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    
  })

  // win.webContents.openDevTools({ mode: 'detach' })

  Menu.setApplicationMenu(applicationMenuFunction())

  await win.loadFile('src/renderer/index.html')
  const tabs = new TabManager(win)
  const downloads = new DownloadManager(win)
  registerIpcHandlers(tabs, downloads)

  win.on('resize', () => {
    for (const { view } of tabs.tabs.values()) tabs._resizeView(view) 
  })

  tabs.createTab()
})