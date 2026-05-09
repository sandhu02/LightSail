export const CONTROLS_SECTIONS = [
  { id: 'history', title: 'History' },
  { id: 'downloads', title: 'Downloads' },
  { id: 'help', title: 'Help' },
  { id: 'appearance', title: 'Wallpaper & Appearance' },
  { id: 'startup', title: 'On Startup' },
  { id: 'search', title: 'Default Search Engine' },
  { id: 'bookmarks', title: 'Bookmarks' },
  { id: 'ai', title: 'AI Settings' }
]

export const controlsState = {
  history: [],
  downloads: [
    { file: 'project-proposal.pdf', size: '2.1 MB', status: 'Completed' },
    { file: 'browser-theme-pack.zip', size: '18.4 MB', status: 'Completed' }
  ],
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
  ]
}


// Load history asynchronously
async function loadHistory() {
  try {
    const history = await ipcRenderer.invoke('main:browsingHistory')
    history = filterInternalPages(history)
    controlsState.history = history
    // Optionally trigger a UI update
    if (window.updateControlsUI) window.updateControlsUI()
  } catch (error) {
    console.error('Failed to load history:', error)
    controlsState.history = []
  }
}

function filterInternalPages(history) {
  history = history.filter(entry => {
      // Exclude file:// URLs
      if (entry.url.startsWith('file://')) return false
      
      // Exclude specific internal pages
      const internalPages = [
        'HomeScreen.html',
        'ControlsScreen.html', 
        'ProfileScreen.html',
        'settings',
        'preferences'
      ]
      
      if (internalPages.some(page => entry.url.includes(page))) return false
      
      // Exclude empty URLs
      if (!entry.url || entry.url === '') return false
      
      // Only keep http:// and https:// URLs
      return entry.url.startsWith('http://') || entry.url.startsWith('https://')
    })

  return history  
}


// Call the async function
loadHistory()