BASE_URL = 'http://13.48.28.103.nip.io'
// BASE_URL = 'http://localhost'

AUTH_PORT = 8080

AUTH_URL = `${BASE_URL}:${AUTH_PORT}/auth/google/`

CHAT_PORT = 8000

GET_SESSION_URL = `${BASE_URL}:${CHAT_PORT}/getSession`

GET_CHAT_URL = `${BASE_URL}:${CHAT_PORT}/getChat`

QUERY_URL = `${BASE_URL}:${CHAT_PORT}/query`

module.exports = {
  BASE_URL,
  AUTH_PORT,
  CHAT_PORT,
  AUTH_URL,
  GET_SESSION_URL,
  GET_CHAT_URL,
  QUERY_URL
}