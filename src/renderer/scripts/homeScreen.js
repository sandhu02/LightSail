const googleSearchEl = document.getElementById('google-search')
const ghostBtn = document.getElementById('ghost-mode-btn')
const wallpaperLayer = document.getElementById('wallpaper-layer')
const ghostStatusHint = document.getElementById('ghost-status-hint')

function applyWallpaper(wallpaper) {
    if (!wallpaperLayer) return
    const wp = wallpaper || 'home_wallpaper_3.jpg'
    if (wp.startsWith('file://') || wp.startsWith('data:')) {
        wallpaperLayer.style.backgroundImage = `url('${wp}')`
    } else {
        wallpaperLayer.style.backgroundImage = `url('../../../assets/images/${wp}')`
    }
}

function updateGhostUI(isGhost) {
    if (isGhost) {
        document.body.classList.add('ghost-mode-active')
        if (ghostBtn) {
            ghostBtn.setAttribute('aria-pressed', 'true')
            ghostBtn.title = 'Ghost Mode is ON for this tab (Click to disable)'
        }
        if (googleSearchEl) {
            googleSearchEl.placeholder = 'Search Google in Ghost Mode'
        }
        if (ghostStatusHint) {
            ghostStatusHint.textContent = 'Ghost Mode active — history and account data are not saved'
        }
    } else {
        document.body.classList.remove('ghost-mode-active')
        if (ghostBtn) {
            ghostBtn.setAttribute('aria-pressed', 'false')
            ghostBtn.title = 'Ghost Mode is OFF for this tab (Click to enable)'
        }
        if (googleSearchEl) {
            googleSearchEl.placeholder = 'Search Google'
        }
        if (ghostStatusHint) {
            ghostStatusHint.textContent = ''
        }
    }
}

// Initial setup
async function init() {
    let savedWallpaper = localStorage.getItem('lightSail-wallpaper')
    if (window.ghostMode?.getSavedWallpaper) {
        try {
            const serverWp = await window.ghostMode.getSavedWallpaper()
            if (serverWp) savedWallpaper = serverWp
        } catch (_) {}
    }
    applyWallpaper(savedWallpaper || 'home_wallpaper_3.jpg')
    if (savedWallpaper && window.ghostMode?.syncWallpaper) {
        window.ghostMode.syncWallpaper(savedWallpaper)
    }

    if (window.ghostMode?.getState) {
        try {
            const state = await window.ghostMode.getState()
            updateGhostUI(Boolean(state?.isGhost))
        } catch (e) {
            console.error('Failed to get ghost state:', e)
        }
    }
}

init()

// Wire ghost toggle button
if (ghostBtn) {
    ghostBtn.addEventListener('click', async () => {
        ghostBtn.disabled = true
        try {
            if (window.ghostMode?.toggle) {
                const res = await window.ghostMode.toggle()
                updateGhostUI(Boolean(res?.isGhost))
            } else {
                const isActive = document.body.classList.toggle('ghost-mode-active')
                updateGhostUI(isActive)
            }
        } catch (err) {
            console.error('Failed to toggle ghost mode:', err)
        } finally {
            ghostBtn.disabled = false
        }
    })
}

// Wire search input
if (googleSearchEl) {
    googleSearchEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value.trim()
            if (!query) return
            const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
            if (window.ghostMode?.navigate) {
                window.ghostMode.navigate(targetUrl)
            } else {
                window.location.href = targetUrl
            }
            e.target.value = ''
        }
    })
}

// Wire the voice button to VoiceInputManager
const voiceBtn = document.querySelector('.voice-btn')
if (voiceBtn && googleSearchEl) {
    voiceBtn.addEventListener('click', () => {
        if (window.voiceInputManager) {
            window.voiceInputManager.start(googleSearchEl)
        }
    })
}