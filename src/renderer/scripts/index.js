const sidebar = document.getElementById('sidebar')
const collapseBtn = document.getElementById('collapse-btn')
const tabsEl = document.getElementById('tabs-container')
const toolbarEl = document.getElementById('toolbar')
const DEFAULT_FAVICON = '../../assets/icons/web-icon.svg'

let activeTabId = null

function sendLayoutBounds() {
  if (!window.tabs?.updateLayout || !sidebar || !toolbarEl) return
  window.tabs.updateLayout({
    sidebarWidth: Math.round(sidebar.getBoundingClientRect().width),
    toolbarHeight: Math.round(toolbarEl.getBoundingClientRect().height)
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

document.getElementById('address-bar').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const parsedUrl = window.tabs.addressBarSearch(e.target.value)
    window.tabs.navigate(activeTabId, parsedUrl)
  }
})

document.getElementById('ask-ai')?.addEventListener('click', () => {})
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

window.addEventListener('resize', sendLayoutBounds)
window.addEventListener('load', () => {
  sendLayoutBounds()
  setTimeout(sendLayoutBounds, 50)
})