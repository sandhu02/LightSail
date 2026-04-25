const { Menu, MenuItem } = require("electron")

function contextMenuFunction(win, webContents, params) {
    const ctxMenu = new Menu()

    ctxMenu.append(new MenuItem({ label: 'Back', click: () => webContents.goBack() }))
    ctxMenu.append(new MenuItem({ label: 'Forward', click: () => webContents.goForward() }))
    ctxMenu.append(new MenuItem({ label: 'Reload', click: () => webContents.reload() }))
    ctxMenu.append(new MenuItem({ type: 'separator' }))
    ctxMenu.append(new MenuItem({ label: 'Cut', role: 'cut' }))
    ctxMenu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
    ctxMenu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }))
    ctxMenu.append(new MenuItem({ label: 'Paste', role: 'paste' })) 
    ctxMenu.append(new MenuItem({ label: 'Delete', role: 'delete' })) 
    ctxMenu.append(new MenuItem({ label: 'Undo', role: 'undo' })) 
    ctxMenu.append(new MenuItem({ label: 'Redo', role: 'redo' })) 
    ctxMenu.append(new MenuItem({ 
        label: 'Inspect Element', 
        click: (menuItem, browserWindow, event) => {
            webContents.inspectElement(params.x, params.y)            
        }
    })) 
    
    ctxMenu.popup(win, params.x, params.y)
}

module.exports = { contextMenuFunction };