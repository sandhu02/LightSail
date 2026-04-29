const { WebContentsView } = require('electron')
const { contextMenuFunction } = require('./menus/contextMenu')
const path = require('path')
const { _isInternalPage } = require('../utils/_isInternalPage')

class TabManager {
  constructor(win) {
    this.win = win
    this.tabs = new Map()   // tabId -> { view, url, title }
    this.activeTabId = null
    this.nextId = 1
    this.sidebarWidth = 220
    this.toolbarHeight = 64
  }

  getTabUrl(id) {
    return this.tabs.get(id)?.url || ''
  }

  _getInternalTabTitle(url) {
    if (url.includes('ControlsScreen.html')) return 'Controls'
    if (url.includes('ProfileScreen.html')) return 'Profile'
    return 'New Tab'
  }

  createTab(url = 'src/renderer/components/HomeScreen.html') {
    const absolutePath = path.join(__dirname, '../../', url).replace(/\\/g, '/')
    const fileUrl = `file://${absolutePath}`

    const id = this.nextId++
    const view = new WebContentsView()

    this.win.contentView.addChildView(view)
    this._resizeView(view)

    view.webContents.loadURL(fileUrl)   

    view.webContents.on('context-menu', (e, params) => {
        contextMenuFunction(this.win, view.webContents, params)
    })
 
    view.webContents.on('page-title-updated', (_, title) => {
      const currentUrl = view.webContents.getURL()

      const displayTitle = _isInternalPage(currentUrl)
        ? this._getInternalTabTitle(currentUrl)
        : title

      // update stored title
      const tab = this.tabs.get(id)
      if (tab) tab.title = displayTitle

      this._send('tab:title', { id, title: displayTitle })
    })

    view.webContents.on('did-navigate', (_, url) => {
      const isInternalPage = _isInternalPage(url)
      const displayUrl = isInternalPage ? '' : url
      
      // update stored url and clear favicon on internal pages
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

    this.tabs.set(id, { view, url: fileUrl, title: 'New Tab' })
    this.switchTab(id)
    this._send('tab:created', { id, url: fileUrl })
    return id
  }

  switchTab(id) {
    for (const [tabId, { view }] of this.tabs) {
      view.setVisible(tabId === id)
    }
    this.activeTabId = id

    const url = this.getTabUrl(id);

    const displayUrl = _isInternalPage(url) ? '' : url
      
    // update stored url
    const tab = this.tabs.get(id)
    if (tab) tab.url = url

    this._send('tab:switched', { id, url: displayUrl })
  }

  closeTab(id) {
    const tab = this.tabs.get(id)
    if (!tab) return

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
    view.setBounds({
        x: this.sidebarWidth,
        y: this.toolbarHeight,
        width: Math.max(0, bounds.width - this.sidebarWidth),
        height: Math.max(0, bounds.height - this.toolbarHeight)
    })
  }

  updateLayout(layout = {}) {
    const sidebarWidth = Number(layout.sidebarWidth)
    const toolbarHeight = Number(layout.toolbarHeight)

    if (Number.isFinite(sidebarWidth) && sidebarWidth >= 0) {
      this.sidebarWidth = sidebarWidth
    }

    if (Number.isFinite(toolbarHeight) && toolbarHeight >= 0) {
      this.toolbarHeight = toolbarHeight
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