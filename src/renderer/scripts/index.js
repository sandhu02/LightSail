const sidebar = document.getElementById('sidebar')
const collapseBtn = document.getElementById('collapse-btn')
const tabsEl = document.getElementById('tabs-container')
const toolbarEl = document.getElementById('toolbar')
const controlsBtn = document.getElementById('controls-btn')
const profileBtn = document.getElementById('profile')
const askAiBtn = document.getElementById('ask-ai')
const appRoot = document.getElementById('app')
const askAiPanel = document.getElementById('ask-ai-panel')
const askAiCloseBtn = document.getElementById('ask-ai-close')
const askAiMessagesEl = document.getElementById('ask-ai-messages')
const askAiForm = document.getElementById('ask-ai-form')
const askAiInput = document.getElementById('ask-ai-input')
const askAiSendBtn = document.getElementById('ask-ai-send')
const DEFAULT_FAVICON = '../../assets/icons/web-icon.svg'
const CONTROLS_SCREEN_PATH = 'src/renderer/components/ControlsScreen.html'
const PROFILE_SCREEN_PATH = 'src/renderer/components/ProfileScreen.html'

let activeTabId = null
let askAiLoading = false

function sendLayoutBounds() {
  if (!window.tabs?.updateLayout || !sidebar || !toolbarEl) return
  window.tabs.updateLayout({
    sidebarWidth: Math.round(sidebar.getBoundingClientRect().width),
    toolbarHeight: Math.round(toolbarEl.getBoundingClientRect().height),
    rightInset: appRoot.classList.contains('ask-ai-open') ? 360 : 0
  })
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
    <img class="favicon" src="${withFallbackFavicon(favicon)}" />
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
  if (isOpen) askAiInput?.focus()
  sendLayoutBounds()
}

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
    askAiSendBtn.disabled = isLoading
    askAiSendBtn.textContent = isLoading ? 'Sending...' : 'Send'
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

askAiForm?.addEventListener('submit', async event => {
  event.preventDefault()
  if (askAiLoading || !askAiInput) return

  const prompt = askAiInput.value.trim()
  if (!prompt) return

  appendAskAiMessage('user', prompt)
  askAiInput.value = ''
  setAskAiLoading(true)
  try {
    const response = await window.askAiClient.ask(prompt)
    appendAskAiMessage('assistant', response.answer || 'No response generated.')
  } catch (error) {
    appendAskAiMessage('assistant', `Unable to get response: ${error.message}`)
  } finally {
    setAskAiLoading(false)
  }
})

document.getElementById('google-search')?.addEventListener('click', () => {})

window.tabs.on('tab:created', ({ id }) => renderTab(id))
window.tabs.on('tab:closed', ({ id }) => document.getElementById(`tab-${id}`)?.remove())
window.tabs.on('tab:switched', ({ id, url }) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.getElementById(`tab-${id}`)?.classList.add('active')
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

window.addEventListener('resize', sendLayoutBounds)
window.addEventListener('load', () => {
  sendLayoutBounds()
  setTimeout(sendLayoutBounds, 50)
})

const user = loadUserFromStorage()
if (user) { 
  updateSidebarProfile(user)
}