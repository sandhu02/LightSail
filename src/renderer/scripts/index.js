const sidebar = document.getElementById('sidebar')
const collapseBtn = document.getElementById('collapse-btn')
const tabsEl = document.getElementById('tabs-container')
const toolbarEl = document.getElementById('toolbar')
const controlsBtn = document.getElementById('controls-btn')
const profileBtn = document.getElementById('profile')
const askAiBtn = document.getElementById('ask-ai')
const appRoot = document.getElementById('app')
const askAiPanel = document.getElementById('ask-ai-panel')
const askAiResizeHandle = document.getElementById('ask-ai-resize-handle')
const askAiTitle = document.getElementById('ask-ai-title')
const askAiCloseBtn = document.getElementById('ask-ai-close')
const askAiMessagesEl = document.getElementById('ask-ai-messages')
const askAiForm = document.getElementById('ask-ai-form')
const askAiInput = document.getElementById('ask-ai-input')
const askAiSendBtn = document.getElementById('ask-ai-send')
const autoNavToggleBtn = document.getElementById('auto-nav-toggle')
const agentStopBtn = document.getElementById('agent-stop-btn')
const askAiVoiceBtn = document.getElementById('ask-ai-voice-btn')
const DEFAULT_FAVICON = '../../assets/icons/web-icon.svg'
const CONTROLS_SCREEN_PATH = 'src/renderer/components/ControlsScreen.html'
const PROFILE_SCREEN_PATH = 'src/renderer/components/ProfileScreen.html'

let activeTabId = null
let askAiLoading = false
let autoNavMode = false
const DEFAULT_ASK_AI_WIDTH = 360
const MIN_ASK_AI_WIDTH = 300
const MAX_ASK_AI_WIDTH = 720

function sendLayoutBounds() {
  if (!window.tabs?.updateLayout || !sidebar || !toolbarEl) return
  window.tabs.updateLayout({
    sidebarWidth: Math.round(sidebar.getBoundingClientRect().width),
    toolbarHeight: Math.round(toolbarEl.getBoundingClientRect().height),
    rightInset: appRoot.classList.contains('ask-ai-open') ? Math.round(askAiPanel.getBoundingClientRect().width) : 0
  })
}

function setAskAiWidth(width) {
  const availableWidth = appRoot.clientWidth - sidebar.getBoundingClientRect().width - 320
  const maxWidth = Math.max(MIN_ASK_AI_WIDTH, Math.min(MAX_ASK_AI_WIDTH, availableWidth))
  const clampedWidth = Math.round(Math.max(MIN_ASK_AI_WIDTH, Math.min(maxWidth, width)))
  appRoot.style.setProperty('--ask-ai-width', `${clampedWidth}px`)
  askAiResizeHandle?.setAttribute('aria-valuenow', String(clampedWidth))
  askAiResizeHandle?.setAttribute('aria-valuemax', String(Math.round(maxWidth)))
  sendLayoutBounds()
}

function withFallbackFavicon(favicon) {
  return favicon || DEFAULT_FAVICON
}

function attachFaviconFallback(imgEl) {
  if (!imgEl) return
  imgEl.addEventListener('error', () => {
    if (imgEl.getAttribute('src') !== DEFAULT_FAVICON) {
      imgEl.setAttribute('src', DEFAULT_FAVICON)
    }
  })
}

function renderTab(id, title = 'New Tab', favicon = DEFAULT_FAVICON) {
  const existing = document.getElementById(`tab-${id}`)
  if (existing) return

  const tab = document.createElement('div')
  tab.className = 'tab'
  tab.id = `tab-${id}`
  tab.innerHTML = `
    <div class="tab-favicon-wrapper">
      <img class="favicon" src="${withFallbackFavicon(favicon)}" />
      <span class="ghost-badge-indicator" title="Ghost Tab (Private)">
        <svg class="ghost-badge-icon" width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>
        </svg>
      </span>
    </div>
    <span class="title">${title}</span>
    <button class="close-btn">✕</button>
  `
  attachFaviconFallback(tab.querySelector('.favicon'))

  tab.addEventListener('click', () => window.tabs.switch(id))
  tab.querySelector('.close-btn').addEventListener('click', e => {
    e.stopPropagation()
    window.tabs.close(id)
  })

  tabsEl.appendChild(tab)
}

document.getElementById('new-tab').addEventListener('click', () => window.tabs.create())
document.getElementById('back').addEventListener('click', () => activeTabId && window.tabs.back(activeTabId))
document.getElementById('forward').addEventListener('click', () => activeTabId && window.tabs.forward(activeTabId))
document.getElementById('reload').addEventListener('click', () => activeTabId && window.tabs.reload(activeTabId))
controlsBtn?.addEventListener('click', () => window.tabs.create(CONTROLS_SCREEN_PATH))
profileBtn?.addEventListener('click', () => window.tabs.create(PROFILE_SCREEN_PATH))

document.getElementById('address-bar').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const parsedUrl = window.tabs.addressBarSearch(e.target.value)
    window.tabs.navigate(activeTabId, parsedUrl)
  }
})

function setAskAiOpen(isOpen) {
  appRoot.classList.toggle('ask-ai-open', isOpen)
  askAiPanel?.setAttribute('aria-hidden', String(!isOpen))
  if (isOpen) {
    setAskAiWidth(askAiPanel.getBoundingClientRect().width || DEFAULT_ASK_AI_WIDTH)
    askAiInput?.focus()
  } else {
    sendLayoutBounds()
  }
}

askAiResizeHandle?.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  event.preventDefault()
  askAiResizeHandle.setPointerCapture(event.pointerId)
  appRoot.classList.add('ask-ai-resizing')
})

askAiResizeHandle?.addEventListener('pointermove', event => {
  if (appRoot.classList.contains('ask-ai-resizing')) {
    setAskAiWidth(askAiPanel.getBoundingClientRect().right - event.clientX)
  }
})

function finishAskAiResize() {
  if (!appRoot.classList.contains('ask-ai-resizing')) return
  appRoot.classList.remove('ask-ai-resizing')
  sendLayoutBounds()
}

askAiResizeHandle?.addEventListener('pointerup', finishAskAiResize)
askAiResizeHandle?.addEventListener('pointercancel', finishAskAiResize)
askAiResizeHandle?.addEventListener('lostpointercapture', finishAskAiResize)

window.addEventListener('resize', () => {
  if (appRoot.classList.contains('ask-ai-open')) {
    setAskAiWidth(askAiPanel.getBoundingClientRect().width)
  } else {
    sendLayoutBounds()
  }
})

askAiResizeHandle?.addEventListener('keydown', event => {
  const currentWidth = askAiPanel.getBoundingClientRect().width || DEFAULT_ASK_AI_WIDTH
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    setAskAiWidth(currentWidth + (event.key === 'ArrowLeft' ? 20 : -20))
  } else if (event.key === 'Home') {
    event.preventDefault()
    setAskAiWidth(MIN_ASK_AI_WIDTH)
  } else if (event.key === 'End') {
    event.preventDefault()
    setAskAiWidth(MAX_ASK_AI_WIDTH)
  }
})

function appendAskAiMessage(role, text) {
  if (!askAiMessagesEl) return
  const empty = askAiMessagesEl.querySelector('.ask-ai-empty')
  if (empty) empty.remove()

  const message = document.createElement('div')
  message.className = `ai-message ${role}`
  message.textContent = text
  askAiMessagesEl.appendChild(message)
  askAiMessagesEl.scrollTop = askAiMessagesEl.scrollHeight
}

function setAskAiLoading(isLoading) {
  askAiLoading = isLoading
  if (askAiSendBtn) {
    askAiSendBtn.disabled = isLoading || (autoNavMode && window.autoNavClient?.isRunning())
    askAiSendBtn.textContent = isLoading ? 'Sending...' : (autoNavMode ? 'Run' : 'Send')
  }
}

function setAutoNavMode(isEnabled) {
  autoNavMode = isEnabled
  appRoot.classList.toggle('auto-nav-mode', isEnabled)
  if (askAiTitle) askAiTitle.textContent = isEnabled ? 'Auto Navigate' : 'Ask AI'
  autoNavToggleBtn?.setAttribute('aria-pressed', String(isEnabled))
  autoNavToggleBtn?.setAttribute('title', isEnabled ? 'Switch to Ask AI' : 'Switch to Auto Navigate')
  const emptyMessage = askAiMessagesEl?.querySelector('.ask-ai-empty')
  if (emptyMessage) {
    emptyMessage.textContent = isEnabled
      ? 'Describe a task and the browser will navigate and interact with pages for you.'
      : 'Ask questions about the current page: summarize, explain, or translate content.'
  }
  if (askAiInput && !askAiInput.disabled) {
    askAiInput.placeholder = isEnabled
      ? 'Describe what you want the browser to do...'
      : 'Ask about this page...'
  }
  if (!askAiLoading && askAiSendBtn) {
    askAiSendBtn.textContent = isEnabled ? 'Run' : 'Send'
  }
}

function loadUserFromStorage() {
  const user_id = localStorage.getItem('user_id')
  if (!user_id) return null
  return {
    user_id,
    user_name: localStorage.getItem('user_name') || '-',
    email: localStorage.getItem('email') || '-',
    user_pictre: localStorage.getItem('user_pictre') || ''
  }
}

function updateSidebarProfile(user) {
  // Update profile avatar and info in sidebar
  const profileAvatarEl = document.getElementById('profile-avatar')
  const profileNameEl = document.getElementById('profile-name')
  const profileSubEl = document.getElementById('profile-sub')
  
  if (profileAvatarEl) {
    if (user.user_pictre) {
      profileAvatarEl.style.backgroundImage = `url(${user.user_pictre})`
      profileAvatarEl.style.backgroundSize = 'cover'
      profileAvatarEl.style.backgroundPosition = 'center'
      profileAvatarEl.style.backgroundRepeat = 'no-repeat'
      profileAvatarEl.textContent = ''
    } else {
      profileAvatarEl.style.backgroundImage = ''
      profileAvatarEl.textContent = user.user_name ? user.user_name.slice(0, 2).toUpperCase() : 'UN'
    }
  }
  
  if (profileNameEl) {
    profileNameEl.textContent = user.user_name || 'User'
  }
  
  if (profileSubEl) {
    profileSubEl.textContent = 'Free plan'
  }
}

askAiBtn?.addEventListener('click', () => setAskAiOpen(!appRoot.classList.contains('ask-ai-open')))
askAiCloseBtn?.addEventListener('click', () => setAskAiOpen(false))
autoNavToggleBtn?.addEventListener('click', () => setAutoNavMode(!autoNavMode))

// ── Voice input wiring ──
askAiVoiceBtn?.addEventListener('click', () => {
  if (window.voiceInputManager) window.voiceInputManager.start(askAiInput)
})
agentStopBtn?.addEventListener('click', () => window.autoNavClient?.stop())

askAiForm?.addEventListener('submit', async event => {
  event.preventDefault()
  if (askAiLoading || !askAiInput) return
  if (autoNavMode && window.autoNavClient?.isRunning()) return

  const prompt = askAiInput.value.trim()
  if (!prompt) return

  const uid = localStorage.getItem('user_id') || ''
  appendAskAiMessage('user', prompt)
  askAiInput.value = ''
  setAskAiLoading(true)
  try {
    if (autoNavMode) {
      const result = await window.autoNavClient.start(prompt)
      window.autoNavClient.updateStatus(result.status, result.summary, result.error)
    } else {
      const response = await window.askAiClient.ask(prompt, uid)
      appendAskAiMessage('assistant', response.answer || 'No response generated.')
    }
  } catch (error) {
    if (autoNavMode && window.autoNavClient?.updateStatus) {
      window.autoNavClient.updateStatus('error', null, error.message)
    } else if (autoNavMode) {
      appendAskAiMessage('assistant', `Unable to start Auto Navigate: ${error.message}`)
    } else {
      appendAskAiMessage('assistant', `Unable to get response: ${error.message}`)
    }
  } finally {
    setAskAiLoading(false)
  }
})

document.getElementById('google-search')?.addEventListener('click', () => {})

window.tabs.on('tab:created', ({ id }) => renderTab(id))
window.tabs.on('tab:closed', ({ id }) => document.getElementById(`tab-${id}`)?.remove())
window.tabs.on('tab:switched', ({ id, url, isGhost }) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  const activeEl = document.getElementById(`tab-${id}`)
  if (activeEl) {
    activeEl.classList.add('active')
    if (typeof isGhost === 'boolean') {
      activeEl.classList.toggle('ghost-tab', isGhost)
    }
  }
  activeTabId = id
  document.getElementById('address-bar').value = url
})

window.tabs.on('tab:title', ({ id, title }) => {
  const el = document.querySelector(`#tab-${id} .title`)
  if (el) el.textContent = title
})

window.tabs.on('tab:favicon', ({ id, favicon }) => {
  const img = document.querySelector(`#tab-${id} .favicon`)
  if (!img) return
  img.setAttribute('src', withFallbackFavicon(favicon))
})

window.tabs.on('tab:ghost-mode', ({ id, isGhost }) => {
  const tabEl = document.getElementById(`tab-${id}`)
  if (!tabEl) return
  tabEl.classList.toggle('ghost-tab', Boolean(isGhost))
})

window.tabs.on('tab:url', ({ id, url }) => {
  if (id === activeTabId) {
    document.getElementById('address-bar').value = url
  }
})

collapseBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed')
  requestAnimationFrame(sendLayoutBounds)
  setTimeout(sendLayoutBounds, 350)
})

// Download indicator
const downloadIndicator = document.getElementById('download-indicator')
if (window.electronAPI?.on) {
  window.electronAPI.on('download:indicator', (data) => {
    if (downloadIndicator) {
      downloadIndicator.style.display = data.active ? 'block' : 'none'
    }
  })
}

window.addEventListener('load', () => {
  sendLayoutBounds()
  setTimeout(sendLayoutBounds, 50)
})

const user = loadUserFromStorage()
if (user) { 
  updateSidebarProfile(user)
}