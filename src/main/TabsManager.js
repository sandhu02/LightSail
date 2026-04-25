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
    this.TAB_BAR_HEIGHT = 110
  }

  getTabUrl(id) {
    return this.tabs.get(id)?.url || ''
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

      // if internal page → force "New Tab"
      const displayTitle = _isInternalPage(currentUrl) ? 'New Tab' : title

      // update stored title
      const tab = this.tabs.get(id)
      if (tab) tab.title = displayTitle

      this._send('tab:title', { id, title: displayTitle })
    })

    view.webContents.on('did-navigate', (_, url) => {
      const displayUrl = _isInternalPage(url) ? '' : url
      
      // update stored url
      const tab = this.tabs.get(id)
      if (tab) tab.url = url
      
      this._send('tab:url', { id, url: displayUrl })
    })

    view.webContents.on('page-favicon-updated', (_, favicons) => {
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
    const toolbarHeight = 64
    view.setBounds({
        x: 200,
        y: toolbarHeight,
        width: bounds.width - 200,
        height: bounds.height - toolbarHeight
    })
  }

  _send(channel, data) {
    this.win.webContents.send(channel, data)
  }
}

module.exports = TabManager