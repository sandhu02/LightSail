export const CONTROLS_SECTIONS = [
  { id: 'history', title: 'History' },
  { id: 'downloads', title: 'Downloads' },
  { id: 'help', title: 'Help' },
  { id: 'appearance', title: 'Wallpaper & Appearance' },
  { id: 'startup', title: 'On Startup' },
  { id: 'search', title: 'Default Search Engine' },
  { id: 'bookmarks', title: 'Bookmarks' }
]

export const controlsState = {
  history: [
    { title: 'LightSail Release Notes', time: 'Today, 10:40 AM' },
    { title: 'Electron API Docs', time: 'Yesterday, 9:12 PM' },
    { title: 'Design Inspiration Board', time: 'Yesterday, 6:01 PM' }
  ],
  downloads: [
    { file: 'project-proposal.pdf', size: '2.1 MB', status: 'Completed' },
    { file: 'browser-theme-pack.zip', size: '18.4 MB', status: 'Completed' }
  ],
  appearance: {
    theme: 'System',
    wallpaper: 'Jet'
  },
  startup: {
    mode: 'continue'
  },
  search: {
    engine: 'Google'
  },
  bookmarks: [
    { title: 'GitHub', url: 'https://github.com' },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' }
  ]
}
