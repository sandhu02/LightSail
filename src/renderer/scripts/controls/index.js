import { CONTROLS_SECTIONS, controlsState } from './config.js'
import { sectionRenderers } from './renderers.js'

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
}

function onNavClick(event) {
  const target = event.target.closest('[data-section-id]')
  if (!target) return
  activeSectionId = target.dataset.sectionId
  renderNav()
  renderContent()
}

navEl.addEventListener('click', onNavClick)

renderNav()
renderContent()
