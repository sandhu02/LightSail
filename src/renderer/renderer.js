// renderer.js
let activeTabId = null
const tabsEl = document.getElementById('tabs-container')

function renderTab(id, title = 'New Tab', favicon = '') {
  const existing = document.getElementById(`tab-${id}`)
  if (existing) return

  const tab = document.createElement('div')
  tab.className = 'tab'
  tab.id = `tab-${id}`
  tab.innerHTML = `
    <img class="favicon" src="${favicon}" />
    <span class="title">${title}</span>
    <button class="close-btn">✕</button>
  `
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
    let url = e.target.value
    let parsedUrl = window.tabs.addressBarSearch(url)
    window.tabs.navigate(activeTabId, parsedUrl)
  }
})

document.getElementById('ask-ai')?.addEventListener('click', () => {})
document.getElementById('google-search')?.addEventListener('click', () => {})

window.tabs.on('tab:created',  ({ id }) => renderTab(id))
window.tabs.on('tab:closed',   ({ id }) => document.getElementById(`tab-${id}`)?.remove())
window.tabs.on('tab:switched', ({ id, url }) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.getElementById(`tab-${id}`)?.classList.add('active')
  activeTabId = id

  document.getElementById('address-bar').value = url
  
})
window.tabs.on('tab:title',    ({ id, title }) => {
  const el = document.querySelector(`#tab-${id} .title`)
  if (el) el.textContent = title
})
window.tabs.on('tab:url',      ({ id, url }) => {
  if (id === activeTabId) {
    document.getElementById('address-bar').value = url
  }
})