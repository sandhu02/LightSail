function addressBarSearchAlgorithm(input) {
  let url = input.trim()

  // empty input
  if (!url) return ''

  // 1. If already a valid URL with protocol
  if (/^(https?:\/\/)/i.test(url)) {
    return url
  }

  // 2. If it looks like a domain (contains dot, no spaces)
  const hasDot = url.includes('.')
  const hasSpaces = url.includes(' ')

  if (hasDot && !hasSpaces) {
    return 'https://' + url
  }

  // 3. localhost or IP address
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?/.test(url)) {
    return 'http://' + url
  }

  // 4. Otherwise → treat as search query
  return 'https://www.google.com/search?q=' + encodeURIComponent(url)
}

module.exports = { addressBarSearchAlgorithm }