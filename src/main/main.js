// main.js
const { app, BrowserWindow, Menu, session } = require('electron')
const path = require('path')
const TabManager = require('./TabsManager')
const { DownloadManager } = require('./DownloadManager')
const { registerIpcHandlers } = require('./ipcHandlers')
const { applicationMenuFunction } = require('./menus/applicationMenu')

// Enable speech recognition / audio capture in Chromium
app.commandLine.appendSwitch('enable-speech-input')
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI')

let sharedDownloads = null

async function createLightSailWindow(initialUrl = 'src/renderer/components/HomeScreen.html', isGhost = false) {
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

  await win.loadFile('src/renderer/index.html')
  const tabs = new TabManager(win)

  win.webContents.setWindowOpenHandler((details) => {
    if (details.url && details.url !== 'about:blank') {
      tabs.createTab(details.url)
    }
    return { action: 'deny' }
  })

  win.on('resize', () => {
    for (const { view } of tabs.tabs.values()) tabs._resizeView(view) 
  })

  tabs.createTab(initialUrl, isGhost)
  return { win, tabs }
}

TabManager.createWindowFn = createLightSailWindow

app.whenReady().then(async () => {
  // Grant microphone permission so SpeechRecognition works in the renderer
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'audioCapture']
    callback(allowed.includes(permission))
  })

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'microphone', 'audioCapture']
    return allowed.includes(permission)
  })

  Menu.setApplicationMenu(applicationMenuFunction())

  sharedDownloads = new DownloadManager(null)
  registerIpcHandlers(null, sharedDownloads)

  await createLightSailWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})