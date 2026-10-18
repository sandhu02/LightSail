const { WebContentsView, BrowserWindow, session, shell } = require('electron')
const { contextMenuFunction } = require('./menus/contextMenu')
const path = require('path')
const { _isInternalPage } = require('../utils/_isInternalPage')

class TabManager {
  static instances = new Map() // win.id -> TabManager
  static createWindowFn = null

  static forWebContents(webContents) {
    if (!webContents) return null
    const win = BrowserWindow.fromWebContents(webContents)
    if (win && TabManager.instances.has(win.id)) {
      return TabManager.instances.get(win.id)
    }
    for (const manager of TabManager.instances.values()) {
      if (manager.getTabByWebContentsId(webContents.id)) {
        return manager
      }
    }
    return null
  }

  constructor(win) {
    this.win = win
    this.tabs = new Map()   // tabId -> { view, url, title, favicon, isGhost, isGhostPartition }
    this.activeTabId = null
    this.nextId = 1
    this.sidebarWidth = 220
    this.toolbarHeight = 64
    this.rightInset = 0
    this.bottomInset = 0
    this.cachedWallpaper = 'home_wallpaper_3.jpg'

    TabManager.instances.set(win.id, this)
    win.on('closed', () => {
      TabManager.instances.delete(win.id)
    })
  }

  openInNewWindow(url, isGhost = false) {
    if (typeof TabManager.createWindowFn === 'function') {
      return TabManager.createWindowFn(url, isGhost)
    }
  }

  getTabUrl(id) {
    return this.tabs.get(id)?.url || ''
  }

  getActiveWebContents() {
    const activeTab = this.tabs.get(this.activeTabId)
    return activeTab?.view?.webContents || null
  }

  getTabByWebContentsId(webContentsId) {
    for (const [id, tab] of this.tabs.entries()) {
      if (tab.view?.webContents?.id === webContentsId) {
        return { id, ...tab }
      }
    }
    return null
  }

  setTabGhostMode(id, isGhost) {
    const tab = this.tabs.get(id)
    if (!tab) return
    tab.isGhost = Boolean(isGhost)
    this._send('tab:ghost-mode', { id, isGhost: tab.isGhost })
  }

  _getInternalTabTitle(url) {
    if (url.includes('ControlsScreen.html')) return 'Controls'
    if (url.includes('ProfileScreen.html')) return 'Profile'
    return 'New Tab'
  }

  getBrowsingHistory() {
    const history = []
    for (const [tabId, tab] of this.tabs.entries()) {
      // In ghost mode, history is never tracked or returned
      if (tab.isGhost) {
        continue
      }
      const { view } = tab
      try {
        const navHistory = view.webContents.navigationHistory
        const length = navHistory.length()
        
        if (length > 0) {
          for (let i = 0; i < length; i++) {
            const entry = navHistory.getEntryAtIndex(i)
            if (entry && entry.url && !_isInternalPage(entry.url)) {
              history.push({
                tabId: tabId,
                title: entry.title || 'Untitled',
                url: entry.url,
                timestamp: Date.now()
              })
            }
          }
        }
      } catch (error) {
        console.error(`Failed to get history for tab ${tabId}:`, error)
      }
    }
    return history
  }

  _attachViewEvents(id, view) {
    view.webContents.on('context-menu', (e, params) => {
      contextMenuFunction(this.win, view.webContents, params, this, id)
    })

    view.webContents.setWindowOpenHandler((details) => {
      const targetUrl = details.url
      if (targetUrl && targetUrl !== 'about:blank') {
        if (targetUrl.startsWith('mailto:')) {
          shell.openExternal(targetUrl).catch(() => {})
          return { action: 'deny' }
        }
        const currentTab = this.tabs.get(id)
        const isGhost = Boolean(currentTab?.isGhost)
        this.createTab(targetUrl, isGhost, true)
      }
      return { action: 'deny' }
    })

    view.webContents.on('page-title-updated', (_, title) => {
      const currentUrl = view.webContents.getURL()

      const displayTitle = _isInternalPage(currentUrl)
        ? this._getInternalTabTitle(currentUrl)
        : title

      const tab = this.tabs.get(id)
      if (tab) tab.title = displayTitle

      this._send('tab:title', { id, title: displayTitle })
    })

    view.webContents.on('did-navigate', (_, url) => {
      const isInternalPage = _isInternalPage(url)
      const displayUrl = isInternalPage ? '' : url
      
      const tab = this.tabs.get(id)
      if (tab) {
        tab.url = url
        if (isInternalPage) tab.favicon = ''
      }
      
      this._send('tab:url', { id, url: displayUrl })
      if (isInternalPage) {
        this._send('tab:favicon', { id, favicon: '' })
      }
    })

    view.webContents.on('page-favicon-updated', (_, favicons) => {
      const tab = this.tabs.get(id)
      if (tab) tab.favicon = favicons[0] || ''
      this._send('tab:favicon', { id, favicon: favicons[0] })
    })

    // Intercept in-page navigation (e.g. search form submit or link click)
    // to guarantee that partition isolation matches the ghost state
    view.webContents.on('will-navigate', (event, targetUrl) => {
      const tab = this.tabs.get(id)
      if (!tab) return
      const isInternal = _isInternalPage(targetUrl)
      const wantsGhost = Boolean(tab.isGhost)
      if (!isInternal && Boolean(tab.isGhostPartition) !== wantsGhost) {
        event.preventDefault()
        this.navigateTab(id, targetUrl)
      }
    })
  }

  _createView(id, isGhost = false) {
    const webPreferences = {
      preload: path.join(__dirname, '../preload/viewPreload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }

    if (isGhost) {
      // In-memory partition specific to this tab (no persist: prefix)
      // Ensures complete isolation: no saved accounts, cookies or history
      webPreferences.partition = `ghost-tab-${id}`
    }

    const view = new WebContentsView({ webPreferences })
    this._attachViewEvents(id, view)
    return view
  }

  _swapTabView(id, wantsGhost) {
    const tab = this.tabs.get(id)
    if (!tab) return null

    const oldView = tab.view
    const newView = this._createView(id, wantsGhost)

    this.win.contentView.addChildView(newView)
    this._resizeView(newView)
    newView.setVisible(this.activeTabId === id)

    tab.view = newView
    tab.isGhostPartition = wantsGhost

    if (oldView) {
      this.win.contentView.removeChildView(oldView)
      try {
        oldView.webContents.destroy()
      } catch (err) {
        console.error(`Failed to destroy previous view for tab ${id}:`, err)
      }
    }

    return newView
  }

  getHomeUrl() {
    const absolutePath = path.join(__dirname, '../../src/renderer/components/HomeScreen.html').replace(/\\/g, '/')
    return `file://${absolutePath}`
  }

  async navigateTab(id, url) {
    const tab = this.tabs.get(id)
    if (!tab) return

    const isInternal = _isInternalPage(url)
    const wantsGhost = Boolean(tab.isGhost)

    // When navigating to external pages, ensure the session partition matches ghost mode
    if (!isInternal && Boolean(tab.isGhostPartition) !== wantsGhost) {
      const wasAtHome = _isInternalPage(tab.url) || tab.url.includes('HomeScreen.html')
      const newView = this._swapTabView(id, wantsGhost)
      if (wasAtHome) {
        try {
          await newView.webContents.loadURL(this.getHomeUrl())
        } catch (_) {}
      }
    }

    try {
      await tab.view.webContents.loadURL(url)
    } catch (err) {
      console.error(`Failed to load URL ${url} in tab ${id}:`, err)
    }
  }

  goBack(id) {
    const tab = this.tabs.get(id)
    const view = tab?.view
    if (view?.webContents.canGoBack()) {
      view.webContents.goBack()
    } else if (tab && !_isInternalPage(tab.url)) {
      this.navigateTab(id, this.getHomeUrl())
    }
  }

  goForward(id) {
    const view = this.tabs.get(id)?.view
    if (view?.webContents.canGoForward()) {
      view.webContents.goForward()
    }
  }

  createTab(targetUrl = 'src/renderer/components/HomeScreen.html', isGhost = false, activate = true) {
    let finalUrl = targetUrl
    let isInternal = false

    if (!targetUrl || targetUrl === 'src/renderer/components/HomeScreen.html') {
      finalUrl = this.getHomeUrl()
      isInternal = true
    } else if (typeof targetUrl === 'string' && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('file://'))) {
      finalUrl = targetUrl
      isInternal = _isInternalPage(finalUrl)
    } else {
      const absolutePath = path.join(__dirname, '../../', targetUrl).replace(/\\/g, '/')
      finalUrl = `file://${absolutePath}`
      isInternal = _isInternalPage(finalUrl)
    }

    // Check if this is an internal page and already open
    if (isInternal && !finalUrl.includes('HomeScreen.html')) {
      for (const [existingId, { url: existingUrl }] of this.tabs) {
        if (existingUrl.includes(targetUrl) || existingUrl === finalUrl) {
          this.switchTab(existingId)
          return existingId
        }
      }
    }

    const id = this.nextId++
    const wantsGhost = Boolean(isGhost)
    const view = this._createView(id, wantsGhost)

    this.win.contentView.addChildView(view)
    this._resizeView(view)

    view.webContents.loadURL(finalUrl).catch(err => {
      console.error(`Failed to load URL ${finalUrl} in tab ${id}:`, err)
    })

    const initialTitle = isInternal ? this._getInternalTabTitle(finalUrl) : 'New Tab'

    this.tabs.set(id, { 
      view, 
      url: finalUrl, 
      title: initialTitle, 
      favicon: '', 
      isGhost: wantsGhost, 
      isGhostPartition: wantsGhost 
    })

    if (activate) {
      this.switchTab(id)
    } else {
      view.setVisible(false)
    }

    this._send('tab:created', { id, url: finalUrl })
    if (wantsGhost) {
      this._send('tab:ghost-mode', { id, isGhost: true })
    }
    return id
  }

  switchTab(id) {
    for (const [tabId, { view }] of this.tabs) {
      view.setVisible(tabId === id)
    }
    this.activeTabId = id

    const url = this.getTabUrl(id);
    const displayUrl = _isInternalPage(url) ? '' : url
    const tab = this.tabs.get(id)
    if (tab) tab.url = url

    this._send('tab:switched', { id, url: displayUrl, isGhost: Boolean(tab?.isGhost) })
  }

  closeTab(id) {
    const tab = this.tabs.get(id)
    if (!tab) return

    // Clean up ghost session storage if tab was in ghost mode
    if (tab.isGhost || tab.isGhostPartition) {
      try {
        const ghostSession = session.fromPartition(`ghost-tab-${id}`)
        ghostSession.clearStorageData().catch(() => {})
      } catch (err) {
        console.error(`Error clearing storage for ghost tab ${id}:`, err)
      }
    }

    this.win.contentView.removeChildView(tab.view)
    tab.view.webContents.destroy()
    this.tabs.delete(id)

    if (this.tabs.size === 0) {
      this.createTab()  // always keep at least one tab
    } else if (this.activeTabId === id) {
      const lastId = [...this.tabs.keys()].at(-1)
      this.switchTab(lastId)
    }
    this._send('tab:closed', { id })
  }

  _resizeView(view) {
    const bounds = this.win.getContentBounds()
    const bottomInset = this.bottomInset || 0
    view.setBounds({
        x: this.sidebarWidth,
        y: this.toolbarHeight,
        width: Math.max(0, bounds.width - this.sidebarWidth - this.rightInset),
        height: Math.max(0, bounds.height - this.toolbarHeight - bottomInset)
    })
  }

  updateLayout(layout = {}) {
    const sidebarWidth = Number(layout.sidebarWidth)
    const toolbarHeight = Number(layout.toolbarHeight)
    const rightInset = Number(layout.rightInset)
    const bottomInset = Number(layout.bottomInset)

    if (Number.isFinite(sidebarWidth) && sidebarWidth >= 0) {
      this.sidebarWidth = sidebarWidth
    }

    if (Number.isFinite(toolbarHeight) && toolbarHeight >= 0) {
      this.toolbarHeight = toolbarHeight
    }

    if (Number.isFinite(rightInset) && rightInset >= 0) {
      this.rightInset = rightInset
    }

    if (Number.isFinite(bottomInset) && bottomInset >= 0) {
      this.bottomInset = bottomInset
    }

    for (const { view } of this.tabs.values()) {
      this._resizeView(view)
    }
  }

  _send(channel, data) {
    this.win.webContents.send(channel, data)
  }
}

module.exports = TabManager