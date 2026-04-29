const signedOutView = document.getElementById('signed-out-view')
const signedInView = document.getElementById('signed-in-view')
const togglePreviewBtn = document.getElementById('toggle-preview-btn')
const googleSigninBtn = document.getElementById('google-signin-btn')

let isSignedInPreview = false

function renderState() {
  signedOutView.classList.toggle('hidden', isSignedInPreview)
  signedInView.classList.toggle('hidden', !isSignedInPreview)
  togglePreviewBtn.textContent = isSignedInPreview ? 'Preview Signed-Out UI' : 'Preview Signed-In UI'
}

togglePreviewBtn?.addEventListener('click', () => {
  isSignedInPreview = !isSignedInPreview
  renderState()
})

googleSigninBtn?.addEventListener('click', () => {
  // UI-only placeholder until auth backend is wired.
  isSignedInPreview = true
  renderState()
})

renderState()
