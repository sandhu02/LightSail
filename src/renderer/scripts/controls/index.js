import { CONTROLS_SECTIONS, controlsState } from './config.js'
import { sectionRenderers } from './renderers.js'
import { bindAiSettingsSection, hydrateAiSettingsState } from './aiSettingsController.js'

const navEl = document.getElementById('controls-nav')
const contentEl = document.getElementById('controls-content')

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

async function hydrateHistoryState(state) {
  if (!window.internal?.getBrowsingHistory) return
  try {
    const history = await window.internal.getBrowsingHistory()
    if (Array.isArray(history) && history.length) {
      state.history = history
    }
  } catch (error) {
    console.error('Failed to load history:', error)
  }
}

async function init() {
  await hydrateAiSettingsState(controlsState)
  await hydrateHistoryState(controlsState)

  renderNav()
  renderContent()
}

init()
