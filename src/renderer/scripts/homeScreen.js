const googleSearchEl = document.getElementById('google-search')

googleSearchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        e.target.value = ''
    }
})

// Wire the voice button to VoiceInputManager
const voiceBtn = document.querySelector('.voice-btn')
if (voiceBtn && googleSearchEl) {
    voiceBtn.addEventListener('click', () => {
        if (window.voiceInputManager) {
            window.voiceInputManager.start(googleSearchEl)
        }
    })
}

const savedWallpaper = localStorage.getItem('lightSail-wallpaper') || 'home_wallpaper_3.jpg'
if (savedWallpaper.startsWith('file://') || savedWallpaper.startsWith('data:')) {
    document.body.style.background = `url('${savedWallpaper}') no-repeat center center/cover`
} else {
    document.body.style.background = `url('../../../assets/images/${savedWallpaper}') no-repeat center center/cover`
}