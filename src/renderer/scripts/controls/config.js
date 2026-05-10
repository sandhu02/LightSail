export const CONTROLS_SECTIONS = [
  { id: 'history', title: 'History' },
  { id: 'downloads', title: 'Downloads' },
  { id: 'help', title: 'Help' },
  { id: 'appearance', title: 'Wallpaper & Appearance' },
  { id: 'startup', title: 'On Startup' },
  { id: 'search', title: 'Default Search Engine' },
  { id: 'bookmarks', title: 'Bookmarks' },
  { id: 'ai', title: 'AI Settings' },
  { id: 'Developer Tools', title: 'Developer Tools' }
]

export const controlsState = {
  history: [],
  downloads: [],
  activeDownloads: [],
  appearance: {
    theme: 'System',
    wallpaper: localStorage.getItem('lightSail-wallpaper') || 'home_wallpaper_3.jpg'
  },
  startup: {
    mode: 'continue'
  },
  search: {
    engine: 'Google'
  },
  ai: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    providers: [],
    keyStatus: {},
    statusMessage: '',
    statusTone: 'info',
    isSaving: false
  },
  bookmarks: [
    { title: 'GitHub', url: 'https://github.com' },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' }
  ],
  developerTools: {
      isDevToolsOpen: false
  }
}

export function filterInternalPages(history) {
  if (!Array.isArray(history)) return []

  return history.filter(entry => {
    if (!entry || typeof entry.url !== 'string') return false
    if (entry.url.startsWith('file://')) return false

    const internalPages = [
      'HomeScreen.html',
      'ControlsScreen.html',
      'ProfileScreen.html',
      'settings',
      'preferences'
    ]

    if (internalPages.some(page => entry.url.includes(page))) return false
    if (!entry.url || entry.url === '') return false
    return entry.url.startsWith('http://') || entry.url.startsWith('https://')
  })
}