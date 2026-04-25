const { Menu } = require('electron')

function applicationMenuFunction() {
    const template = []

    const appMenu = Menu.buildFromTemplate(template)

    return appMenu
    
}

module.exports = { applicationMenuFunction };