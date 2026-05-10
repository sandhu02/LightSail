import { CONTROLS_SECTIONS, controlsState, filterInternalPages } from './config.js'
import { sectionRenderers } from './renderers.js'
import { bindAiSettingsSection, hydrateAiSettingsState } from './aiSettingsController.js'

const navEl = document.getElementById('controls-nav')
const contentEl = document.getElementById('controls-content')
const HISTORY_STORAGE_KEY = 'lightSail-browsing-history'
const DOWNLOADS_STORAGE_KEY = 'lightSail-downloads-history'

let activeSectionId = CONTROLS_SECTIONS[0].id

function renderNav() {
  navEl.innerHTML = CONTROLS_SECTIONS.map(section => `
    <button
      class="nav-item ${section.id === activeSectionId ? 'active' : ''}"
      data-section-id="${section.id}"
      type="button"
    >
      ${section.title}
    </button>
  `).join('')
}

function renderContent() {
  const section = CONTROLS_SECTIONS.find(item => item.id === activeSectionId)
  const renderSection = sectionRenderers[activeSectionId]
  if (!section || !renderSection) {
    contentEl.innerHTML = '<article class="setting-card"><p>Section unavailable.</p></article>'
    return
  }

  contentEl.innerHTML = renderSection(controlsState)
  if (activeSectionId === 'ai') {
    bindAiSettingsSection(controlsState)
  }
}

function onNavClick(event) {
  const target = event.target.closest('[data-section-id]')
  if (!target) return
  activeSectionId = target.dataset.sectionId
  renderNav()
  renderContent()
}

navEl.addEventListener('click', onNavClick)
contentEl.addEventListener('change', (event) => {
  if (event.target.id === 'wallpaper-select') {
    if (event.target.value === 'custom') {
      document.getElementById('custom-wallpaper-input').click();
    } else {
      const selectedWallpaper = event.target.value;
      localStorage.setItem('lightSail-wallpaper', selectedWallpaper);
      controlsState.appearance.wallpaper = selectedWallpaper;
    }
  } else if (event.target.id === 'custom-wallpaper-input') {
    const file = event.target.files[0];
    if (file) {
      if (file.path) {
        // Electron provides the absolute file path, so we can use file:/// protocol
        const fileUrl = 'file:///' + file.path.replace(/\\/g, '/');
        localStorage.setItem('lightSail-wallpaper', fileUrl);
        controlsState.appearance.wallpaper = fileUrl;
        renderContent();
      } else {
        // Fallback for non-electron environments
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            localStorage.setItem('lightSail-wallpaper', e.target.result);
            controlsState.appearance.wallpaper = e.target.result;
            renderContent();
          } catch(err) {
            alert('Image too large to save to local storage.');
          }
        };
        reader.readAsDataURL(file);
      }
    } else {
      renderContent();
    }
  }
})

contentEl.addEventListener('click', (event) => {
  if (event.target.id === 'clear-history-button') {
    controlsState.history = []
    clearHistoryFromLocalStorage()
    renderContent()
  } else if (event.target.id === 'clear-downloads-button') {
    controlsState.downloads = []
    clearDownloadsFromLocalStorage()
    if (window.downloads?.clearHistory) {
      window.downloads.clearHistory()
    }
    renderContent()
  } else if (event.target.classList.contains('download-show-button')) {
    const savePath = event.target.dataset.savePath
    if (savePath && window.downloads?.showFile) {
      window.downloads.showFile(savePath)
    }
  } else if (event.target.classList.contains('download-pause-button')) {
    const downloadId = event.target.dataset.downloadId
    if (downloadId && window.downloads?.pause) {
      window.downloads.pause(downloadId)
    }
  } else if (event.target.classList.contains('download-resume-button')) {
    const downloadId = event.target.dataset.downloadId
    if (downloadId && window.downloads?.resume) {
      window.downloads.resume(downloadId)
    }
  } else if (event.target.classList.contains('download-cancel-button')) {
    const downloadId = event.target.dataset.downloadId
    if (downloadId && window.downloads?.cancel) {
      window.downloads.cancel(downloadId)
    }
  }
})

function loadHistoryFromLocalStorage() {
  const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(entry => entry && typeof entry.url === 'string')
  } catch (error) {
    console.error('Invalid saved browsing history:', error)
    return []
  }
}

function saveHistoryToLocalStorage(history) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
}

function clearHistoryFromLocalStorage() {
  localStorage.removeItem(HISTORY_STORAGE_KEY)
}

function mergeHistory(savedHistory, liveHistory) {
  const combined = [...savedHistory, ...liveHistory]
    .filter(entry => entry && typeof entry.url === 'string')
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  const seen = new Map()
  for (const entry of combined) {
    const key = `${entry.url}|${entry.title || ''}`
    if (!seen.has(key)) seen.set(key, entry)
  }

  return Array.from(seen.values()).slice(0, 200)
}

async function hydrateHistoryState(state) {
  const savedHistory = loadHistoryFromLocalStorage()
  state.history = savedHistory

  if (!window.internal?.getBrowsingHistory) return

  try {
    const liveHistory = await window.internal.getBrowsingHistory()
    const filteredLiveHistory = filterInternalPages(liveHistory)
    const mergedHistory = mergeHistory(savedHistory, filteredLiveHistory)
    state.history = mergedHistory
    saveHistoryToLocalStorage(mergedHistory)
  } catch (error) {
    console.error('Failed to load history:', error)
  }
}

function loadDownloadsFromLocalStorage() {
  const raw = localStorage.getItem(DOWNLOADS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(entry => entry && typeof entry.file === 'string')
  } catch (error) {
    console.error('Invalid saved downloads history:', error)
    return []
  }
}

function saveDownloadsToLocalStorage(downloads) {
  localStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(downloads))
}

function clearDownloadsFromLocalStorage() {
  localStorage.removeItem(DOWNLOADS_STORAGE_KEY)
}

async function hydrateDownloadsState(state) {
  const savedDownloads = loadDownloadsFromLocalStorage()
  state.downloads = savedDownloads

  if (!window.downloads?.getHistory) return

  try {
    const history = await window.downloads.getHistory()
    if (Array.isArray(history) && history.length) {
      state.downloads = history
      saveDownloadsToLocalStorage(history)
    }
  } catch (error) {
    console.error('Failed to load downloads:', error)
  }
}

async function hydrateActiveDownloadsState(state) {
  if (!window.downloads?.getActive) return

  try {
    const active = await window.downloads.getActive()
    state.activeDownloads = active || []
  } catch (error) {
    console.error('Failed to load active downloads:', error)
    state.activeDownloads = []
  }
}

async function init() {
  await hydrateAiSettingsState(controlsState)
  await hydrateHistoryState(controlsState)
  await hydrateDownloadsState(controlsState)
  await hydrateActiveDownloadsState(controlsState)

  renderNav()
  renderContent()

  // Listen for download events
  if (window.electronAPI?.on) {
    window.electronAPI.on('download:started', (download) => {
      controlsState.activeDownloads.push(download)
      if (activeSectionId === 'downloads') renderContent()
    })

    window.electronAPI.on('download:progress', (progress) => {
      const download = controlsState.activeDownloads.find(d => d.id === progress.id)
      if (download) {
        download.receivedBytes = progress.receivedBytes
        download.totalBytes = progress.totalBytes
        download.state = progress.state
        if (activeSectionId === 'downloads') renderContent()
      }
    })

    window.electronAPI.on('download:finished', (finished) => {
      controlsState.activeDownloads = controlsState.activeDownloads.filter(d => d.id !== finished.id)
      if (finished.state === 'completed') {
        // Refresh downloads history
        hydrateDownloadsState(controlsState).then(() => {
          if (activeSectionId === 'downloads') renderContent()
        })
      } else if (activeSectionId === 'downloads') {
        renderContent()
      }
    })
  }
}

init()
