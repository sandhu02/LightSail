function _isInternalPage(url) {
    return url.startsWith('file://')
}

module.exports = { _isInternalPage }