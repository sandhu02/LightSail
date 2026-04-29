document.getElementById('google-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const input = e.target;
        const query = input.value;

        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`

        // clear the field
        input.value = "";
    }
})