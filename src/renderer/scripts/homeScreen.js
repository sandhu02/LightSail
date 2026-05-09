document.getElementById('google-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const input = e.target;
        const query = input.value;

        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`

        // clear the field
        input.value = "";
    }
});

const savedWallpaper = localStorage.getItem('lightSail-wallpaper') || 'home_wallpaper_3.jpg';
if (savedWallpaper.startsWith('file://') || savedWallpaper.startsWith('data:')) {
    document.body.style.background = `url('${savedWallpaper}') no-repeat center center/cover`;
} else {
    document.body.style.background = `url('../../../assets/images/${savedWallpaper}') no-repeat center center/cover`;
}