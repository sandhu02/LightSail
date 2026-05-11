const signedOutView = document.getElementById('signed-out-view')
const signedInView = document.getElementById('signed-in-view')
const googleSigninBtn = document.getElementById('google-signin-btn')
const profileAvatar = document.querySelector('.profile-avatar')
const profileNameValue = document.getElementById('profile-name-value')
const profileEmailValue = document.getElementById('profile-email-value')
const profileIdValue = document.getElementById('profile-id-value')
const profileStatusValue = document.getElementById('profile-status-value')
const signOutBtn = document.getElementById('sign-out-btn')

function renderSignedInState(isSignedIn) {
  signedOutView.classList.toggle('hidden', isSignedIn)
  signedInView.classList.toggle('hidden', !isSignedIn)
}

function updateProfileUI({ user_name, email, user_pictre, user_id }) {
  if (profileAvatar) {
    profileAvatar.style.backgroundImage = user_pictre ? `url(${user_pictre})` : ''
    profileAvatar.textContent = user_pictre ? '' : (user_name ? user_name.slice(0, 2).toUpperCase() : 'UN')
  }
  if (profileNameValue) profileNameValue.textContent = user_name || '-'
  if (profileEmailValue) profileEmailValue.textContent = email || '-'
  if (profileIdValue) profileIdValue.textContent = user_id || '-'
  if (profileStatusValue) profileStatusValue.textContent = 'Unknown'
}

function saveUserToStorage(user) {
  localStorage.setItem('user_id', user.user_id || '')
  localStorage.setItem('user_name', user.user_name || '')
  localStorage.setItem('email', user.email || '')
  localStorage.setItem('user_pictre', user.user_pictre || '')
}

function loadUserFromStorage() {
  const user_id = localStorage.getItem('user_id')
  if (!user_id) return null
  return {
    user_id,
    user_name: localStorage.getItem('user_name') || '-',
    email: localStorage.getItem('email') || '-',
    user_pictre: localStorage.getItem('user_pictre') || ''
  }
}

function startAuth() {
  if (!window.auth?.start) {
    alert('Authentication is not available in this view.')
    return
  }
  window.auth.start()
}

googleSigninBtn?.addEventListener('click', startAuth)
signOutBtn?.addEventListener('click', () => {
  localStorage.removeItem('user_id')
  localStorage.removeItem('user_name')
  localStorage.removeItem('email')
  localStorage.removeItem('user_pictre')
  updateProfileUI({ user_name: '', email: '', user_pictre: '' })
  renderSignedInState(false)
})

window.auth?.on?.('success', (data) => {
  saveUserToStorage(data)
  updateProfileUI(data)
  renderSignedInState(true)
})

window.auth?.on?.('error', (message) => {
  alert('Authentication failed: ' + message)
})

const storedUser = loadUserFromStorage()
if (storedUser) {
  updateProfileUI(storedUser)
  renderSignedInState(true)
} else {
  renderSignedInState(false)
}
