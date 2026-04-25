function addressBarSearchAlgorithm(url) {
    if (!url.startsWith('http') || !url.startsWith('https:')) {
      url = 'https://' + url
    } else if (!url.endsWith('.com')){
       url = 'https://www.google.com/search?q=' + encodeURIComponent(url)
    }

    return url
}

module.exports = {addressBarSearchAlgorithm}