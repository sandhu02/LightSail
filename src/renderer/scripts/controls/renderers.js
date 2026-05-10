import { getModelOptions, getProviderOptions, hasSavedKey } from './aiConfig.js'
import { formatTimestamp } from '../../../utils/formatTimestamp.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function rowTemplate(label, hint, right) {
  return `
    <div class="row">
      <div class="meta">
        <span class="label">${label}</span>
        <span class="hint">${hint}</span>
      </div>
      ${right}
    </div>
  `
}

function cardTemplate(title, subtitle, body) {
  return `
    <article class="setting-card">
      <h2 class="setting-title">${title}</h2>
      <p class="setting-subtitle">${subtitle}</p>
      ${body}
    </article>
  `
}

export const sectionRenderers = {
  history: state => {
    const items = state.history
      .map(item => `
        <div class="list-item">
          <div class="meta">
            <span class="label">${item.title}</span>
            <span class="hint">${item.url}</span>
          </div>
          <span class="hint">${formatTimestamp(item.timestamp)}</span>
        </div>
      `)
      .join('')

    return cardTemplate(
      'History',
      'Review recently visited pages and clear history.',
      `
        <div class="stack">${items}</div>
        <div class="row">
          <div class="meta">
            <span class="label">History retention</span>
            <span class="hint">Store visits for up to 90 days.</span>
          </div>
          <button id="clear-history-button" class="btn subtle" type="button">Clear History</button>
        </div>
      `
    )
  },

  downloads: state => {
    const items = state.downloads
      .map(item => `
        <div class="list-item">
          <div class="meta">
            <span class="label">${item.file}</span>
            <span class="hint">${item.size} • ${item.status}</span>
          </div>
          <button class="btn subtle" type="button">Show</button>
        </div>
      `)
      .join('')

    return cardTemplate(
      'Downloads',
      'Manage recent files and default download behavior.',
      `
        <div class="stack">${items}</div>
        ${rowTemplate('Default download location', 'Choose where files are stored.', '<button class="btn subtle" type="button">Change Folder</button>')}
      `
    )
  },

  help: () => cardTemplate(
    'Help',
    'Get support resources and browser information.',
    `
      ${rowTemplate('Help Center', 'Browse guides, fixes, and FAQs.', '<button class="btn subtle" type="button">Open</button>')}
      ${rowTemplate('Keyboard Shortcuts', 'See all productivity shortcuts.', '<button class="btn subtle" type="button">View</button>')}
      ${rowTemplate('About LightSail', 'Version 0.1.0 (UI preview)', '<span class="chip">Up to date</span>')}
    `
  ),

  appearance: state => cardTemplate(
    'Wallpaper & Appearance',
    'Personalize the browser with your preferred look.',
    `
      ${rowTemplate(
        'Theme mode',
        'Apply a light, dark, or system theme.',
        `
          <select id="theme-select">
            <option ${state.appearance.theme === 'System' ? 'selected' : ''}>System</option>
            <option ${state.appearance.theme === 'Light' ? 'selected' : ''}>Light</option>
            <option ${state.appearance.theme === 'Dark' ? 'selected' : ''}>Dark</option>
          </select>
        `
      )}
      ${rowTemplate(
        'Wallpaper',
        'Set the Home screen background style.',
        `
          <div style="display: flex; gap: 8px; align-items: center;">
            <select id="wallpaper-select">
              <option value="home_wallpaper_1.jpg" ${state.appearance.wallpaper === 'home_wallpaper_1.jpg' ? 'selected' : ''}>Wheat</option>
              <option value="home_wallpaper_2.jpg" ${state.appearance.wallpaper === 'home_wallpaper_2.jpg' ? 'selected' : ''}>Jet</option>
              <option value="home_wallpaper_3.jpg" ${state.appearance.wallpaper === 'home_wallpaper_3.jpg' ? 'selected' : ''}>Bliss</option>
              <option value="custom" ${state.appearance.wallpaper.startsWith('file://') || state.appearance.wallpaper.startsWith('data:') ? 'selected' : ''}>Custom...</option>
            </select>
            <input type="file" id="custom-wallpaper-input" accept="image/*" style="display: none;" />
          </div>
        `
      )}
    `
  ),

  startup: state => cardTemplate(
    'On Startup',
    'Choose what LightSail opens when launched.',
    `
      ${rowTemplate(
        'Startup behavior',
        'Restore previous session or open selected pages.',
        `
          <select id="startup-mode-select">
            <option value="continue" ${state.startup.mode === 'continue' ? 'selected' : ''}>Continue where you left off</option>
            <option value="new" ${state.startup.mode === 'new' ? 'selected' : ''}>Open new tab page</option>
            <option value="custom" ${state.startup.mode === 'custom' ? 'selected' : ''}>Open a specific page set</option>
          </select>
        `
      )}
    `
  ),

  search: state => cardTemplate(
    'Default Search Engine',
    'Select which engine powers address bar searches.',
    `
      ${rowTemplate(
        'Search engine',
        'You can add more providers later.',
        `
          <select id="search-engine-select">
            <option ${state.search.engine === 'Google' ? 'selected' : ''}>Google</option>
            <option ${state.search.engine === 'Bing' ? 'selected' : ''}>Bing</option>
            <option ${state.search.engine === 'DuckDuckGo' ? 'selected' : ''}>DuckDuckGo</option>
          </select>
        `
      )}
    `
  ),

  bookmarks: state => {
    const items = state.bookmarks
      .map(item => `
        <div class="list-item">
          <div class="meta">
            <span class="label">${item.title}</span>
            <span class="hint">${item.url}</span>
          </div>
          <button class="btn subtle" type="button">Open</button>
        </div>
      `)
      .join('')

    return cardTemplate(
      'Bookmarks',
      'Access and organize your saved sites.',
      `
        <div class="stack">${items}</div>
        ${rowTemplate('Add bookmark', 'Save a new page manually.', '<button class="btn primary" type="button">Add Bookmark</button>')}
      `
    )
  },

  ai: state => {
    const providerOptions = getProviderOptions(state.ai)
      .map(provider => `<option value="${provider.id}" ${state.ai.provider === provider.id ? 'selected' : ''}>${provider.label}</option>`)
      .join('')

    const modelOptions = getModelOptions(state.ai, state.ai.provider)
      .map(model => `<option value="${model}"></option>`)
      .join('')

    const keyConfigured = hasSavedKey(state.ai, state.ai.provider)

    return cardTemplate(
      'AI Settings',
      'Configure the provider, model, and API key used by Ask AI.',
      `
        ${rowTemplate(
          'Provider',
          'Select which LLM provider Ask AI should use.',
          `
            <select id="ai-provider-select">
              ${providerOptions}
            </select>
          `
        )}
        ${rowTemplate(
          'Model',
          'Choose a suggested model or type a compatible custom id.',
          `
            <div class="ai-input-group">
              <input id="ai-model-input" type="text" value="${escapeHtml(state.ai.model)}" placeholder="Model name" list="ai-model-suggestions" />
              <datalist id="ai-model-suggestions">${modelOptions}</datalist>
            </div>
          `
        )}
        ${rowTemplate(
          'API key',
          'Stored securely on this device and never sent back to the renderer.',
          `<input id="ai-api-key-input" type="password" value="" placeholder="Paste a new API key" />`
        )}
        ${rowTemplate(
          'Current key status',
          'A configured key is required before Ask AI can respond.',
          `<span class="chip" id="ai-key-status-chip" data-status="${keyConfigured ? 'configured' : 'missing'}">${keyConfigured ? 'Configured' : 'Not set'}</span>`
        )}
        <div class="row">
          <div class="meta">
            <span class="label">Apply configuration</span>
            <span class="hint">Save provider and model, then optionally replace or clear the current provider key.</span>
          </div>
          <div class="actions">
            <button class="btn subtle" type="button" id="ai-settings-clear-key-btn" ${keyConfigured ? '' : 'disabled'}>Clear key</button>
            <button class="btn primary" type="button" id="ai-settings-save-btn">Save</button>
          </div>
        </div>
        <p id="ai-settings-status" class="inline-status" data-tone="${state.ai.statusTone}" ${state.ai.statusMessage ? '' : 'hidden'}>${state.ai.statusMessage}</p>
      `
    )
  }
}