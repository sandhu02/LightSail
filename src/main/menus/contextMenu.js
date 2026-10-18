const { Menu, MenuItem, clipboard } = require("electron")

function contextMenuFunction(win, webContents, params, tabsManager, tabId) {
    const ctxMenu = new Menu()
    const linkURL = params.linkURL ? params.linkURL.trim() : ''

    // 1. Link items
    if (linkURL && !linkURL.startsWith('javascript:')) {
        ctxMenu.append(new MenuItem({
            label: 'Open in new tab',
            click: () => {
                const currentTab = tabsManager?.tabs.get(tabId)
                const isGhost = Boolean(currentTab?.isGhost)
                tabsManager?.createTab(linkURL, isGhost, true)
            }
        }))
        ctxMenu.append(new MenuItem({
            label: 'Open in new window',
            click: () => {
                const currentTab = tabsManager?.tabs.get(tabId)
                const isGhost = Boolean(currentTab?.isGhost)
                tabsManager?.openInNewWindow(linkURL, isGhost)
            }
        }))
        ctxMenu.append(new MenuItem({
            label: 'Copy link address',
            click: () => {
                clipboard.writeText(linkURL)
            }
        }))
        ctxMenu.append(new MenuItem({ type: 'separator' }))
    }

    // 2. Image items
    if (params.mediaType === 'image' && params.srcURL) {
        ctxMenu.append(new MenuItem({
            label: 'Open image in new tab',
            click: () => {
                const currentTab = tabsManager?.tabs.get(tabId)
                const isGhost = Boolean(currentTab?.isGhost)
                tabsManager?.createTab(params.srcURL, isGhost, true)
            }
        }))
        ctxMenu.append(new MenuItem({
            label: 'Open image in new window',
            click: () => {
                const currentTab = tabsManager?.tabs.get(tabId)
                const isGhost = Boolean(currentTab?.isGhost)
                tabsManager?.openInNewWindow(params.srcURL, isGhost)
            }
        }))
        ctxMenu.append(new MenuItem({
            label: 'Copy image address',
            click: () => {
                clipboard.writeText(params.srcURL)
            }
        }))
        ctxMenu.append(new MenuItem({ type: 'separator' }))
    }

    // 3. Navigation items
    ctxMenu.append(new MenuItem({
        label: 'Back',
        enabled: webContents.canGoBack(),
        click: () => webContents.goBack()
    }))
    ctxMenu.append(new MenuItem({
        label: 'Forward',
        enabled: webContents.canGoForward(),
        click: () => webContents.goForward()
    }))
    ctxMenu.append(new MenuItem({
        label: 'Reload',
        click: () => webContents.reload()
    }))
    ctxMenu.append(new MenuItem({ type: 'separator' }))

    // 4. Editing items
    if (params.isEditable) {
        ctxMenu.append(new MenuItem({ label: 'Undo', role: 'undo' }))
        ctxMenu.append(new MenuItem({ label: 'Redo', role: 'redo' }))
        ctxMenu.append(new MenuItem({ type: 'separator' }))
        ctxMenu.append(new MenuItem({ label: 'Cut', role: 'cut' }))
        ctxMenu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
        ctxMenu.append(new MenuItem({ label: 'Paste', role: 'paste' }))
        ctxMenu.append(new MenuItem({ label: 'Delete', role: 'delete' }))
        ctxMenu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }))
    } else {
        if (params.selectionText && params.selectionText.trim().length > 0) {
            ctxMenu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
            ctxMenu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }))
        } else if (!linkURL && params.mediaType !== 'image') {
            ctxMenu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }))
        }
    }

    // 5. Developer inspection
    ctxMenu.append(new MenuItem({ type: 'separator' }))
    ctxMenu.append(new MenuItem({ 
        label: 'Inspect Element', 
        click: () => {
            webContents.inspectElement(params.x, params.y)            
        }
    })) 
    
    ctxMenu.popup({ window: win })
}

module.exports = { contextMenuFunction }