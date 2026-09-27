/**
 * VoiceInputManager — Reusable voice-to-text module for LightSail
 *
 * Backend: MediaRecorder (local) → IPC → OpenAI Whisper API
 * This replaces the broken Web Speech API which requires Google's cloud.
 *
 * Usage:
 *   window.voiceInputManager.start(targetInputElement)
 *
 * The popup appears, records audio locally via MediaRecorder,
 * sends the audio blob to the main process which calls Whisper,
 * and inserts the returned text into targetInputElement.
 */
class VoiceInputManager {
  constructor() {
    this._mediaRecorder = null
    this._stream = null
    this._chunks = []
    this._overlay = null
    this._targetEl = null
    this._isListening = false
    this._bars = []
    this._animFrame = null
    this._animTimer = null

    this._injectStyles()
    this._buildOverlay()
  }

  /* ─────────────── Public API ─────────────── */

  /**
   * Start recording and transcribe into targetEl via Whisper.
   * @param {HTMLInputElement|HTMLTextAreaElement} targetEl
   * @param {object} [opts]
   * @param {boolean} [opts.append=false]  append to existing text
   */
  async start(targetEl, opts = {}) {
    if (this._isListening) this.stop()

    this._targetEl = targetEl
    this._chunks = []

    // Request mic access
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (err) {
      this._showOverlay()
      this._setStatus('\u26a0\ufe0f Microphone access denied.')
      this._setListeningState(false)
      setTimeout(() => this._hideOverlay(), 3000)
      return
    }

    this._stream = stream
    this._isListening = true
    this._showOverlay()
    this._startWaveAnim()

    // Pick best supported format
    const mimeType = this._pickMimeType()
    const recOpts = mimeType ? { mimeType } : {}

    const recorder = new MediaRecorder(stream, recOpts)
    this._mediaRecorder = recorder

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data)
    }

    recorder.onstop = async () => {
      this._stopMic()
      this._stopWaveAnim()
      this._setListeningState(false)
      this._setStatus('Transcribing\u2026')

      const blob = new Blob(this._chunks, { type: mimeType || 'audio/webm' })
      this._chunks = []

      console.log(`[VoiceInput] Recorded audio blob size: ${blob.size} bytes, type: ${blob.type}`)
      if (blob.size === 0) {
        this._setStatus('No audio recorded.')
        setTimeout(() => this._hideOverlay(), 1200)
        return
      }

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuffer)

        // Send to main process for transcription
        const result = await window.electronAPI.transcribeAudio({
          audioData: Array.from(uint8),
          mimeType: mimeType || 'audio/webm'
        })
        console.log('[VoiceInput] Transcription result received:', result)

        if (result.error) {
          this._setStatus('\u26a0\ufe0f ' + result.error)
          setTimeout(() => this._hideOverlay(), 3500)
          return
        }

        const transcript = (result.text || '').trim()
        const existing = opts.append ? (targetEl.value || '') : ''
        const full = (existing + (existing ? ' ' : '') + transcript).trim()

        this._updateTranscriptDisplay(full || '(no speech detected)')
        if (targetEl && transcript) targetEl.value = full

        this._setStatus(transcript ? 'Done.' : 'No speech detected.')
        setTimeout(() => this._hideOverlay(), 1200)
      } catch (err) {
        console.error('[VoiceInput] Transcription error:', err)
        this._setStatus('\u26a0\ufe0f Transcription failed: ' + err.message)
        setTimeout(() => this._hideOverlay(), 3500)
      }
    }

    recorder.onerror = (e) => {
      console.error('[VoiceInput] MediaRecorder error:', e)
      this._setStatus('\u26a0\ufe0f Recording error.')
      this._stopMic()
      this._stopWaveAnim()
      this._setListeningState(false)
      setTimeout(() => this._hideOverlay(), 3000)
    }

    // Collect data every 250ms for smooth streaming
    recorder.start(250)
  }

  stop() {
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop()   // triggers onstop → transcribe
    } else {
      this._stopMic()
      this._stopWaveAnim()
      this._setListeningState(false)
    }
    this._isListening = false
  }

  _stopMic() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop())
      this._stream = null
    }
    this._mediaRecorder = null
  }

  _pickMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4'
    ]
    return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
  }

  /* ─────────────── Overlay UI ─────────────── */

  _buildOverlay() {
    const overlay = document.createElement('div')
    overlay.id = 'vim-overlay'
    overlay.innerHTML = `
      <div id="vim-modal" role="dialog" aria-modal="true" aria-label="Voice Input">
        <button id="vim-close" aria-label="Close voice input">&#x2715;</button>

        <div id="vim-icon-ring">
          <div id="vim-pulse-ring"></div>
          <div id="vim-mic-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z"
                    stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity="0.2"/>
              <path d="M6 11.5a6 6 0 0 0 12 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M12 17.5V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M9 21h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <div id="vim-wave-container">
          <div class="vim-bar"></div><div class="vim-bar"></div><div class="vim-bar"></div>
          <div class="vim-bar"></div><div class="vim-bar"></div><div class="vim-bar"></div>
          <div class="vim-bar"></div><div class="vim-bar"></div><div class="vim-bar"></div>
          <div class="vim-bar"></div><div class="vim-bar"></div><div class="vim-bar"></div>
          <div class="vim-bar"></div><div class="vim-bar"></div><div class="vim-bar"></div>
          <div class="vim-bar"></div><div class="vim-bar"></div><div class="vim-bar"></div>
          <div class="vim-bar"></div><div class="vim-bar"></div>
        </div>

        <p id="vim-status">Recording&#x2026;</p>
        <p id="vim-hint">Speak now &mdash; press <b>Stop</b> when done</p>
        <p id="vim-transcript" aria-live="polite"></p>

        <div id="vim-actions">
          <button id="vim-stop-btn">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor"/>
            </svg>
            Stop &amp; Transcribe
          </button>
          <button id="vim-clear-btn">Cancel</button>
        </div>
      </div>
    `

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeAndDismiss()
    })

    overlay.querySelector('#vim-close').addEventListener('click', () => this._closeAndDismiss())
    overlay.querySelector('#vim-stop-btn').addEventListener('click', () => this.stop())
    overlay.querySelector('#vim-clear-btn').addEventListener('click', () => this._closeAndDismiss())

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._overlay && this._overlay.classList.contains('vim-visible')) {
        this._closeAndDismiss()
      }
    })

    document.body.appendChild(overlay)
    this._overlay = overlay
    this._bars = Array.from(overlay.querySelectorAll('.vim-bar'))
  }

  _showOverlay() {
    if (!this._overlay) return
    this._overlay.classList.add('vim-visible')
    this._setStatus('Recording\u2026')
    this._updateTranscriptDisplay('')
    this._setListeningState(true)
  }

  _hideOverlay() {
    if (!this._overlay) return
    this._overlay.classList.remove('vim-visible')
  }

  _closeAndDismiss() {
    this.stop()
    this._stopWaveAnim()
    this._stopMic()
    this._hideOverlay()
  }

  _setStatus(text) {
    const el = this._overlay && this._overlay.querySelector('#vim-status')
    if (el) el.textContent = text
  }

  _setListeningState(isListening) {
    const ring = this._overlay && this._overlay.querySelector('#vim-pulse-ring')
    const stopBtn = this._overlay && this._overlay.querySelector('#vim-stop-btn')
    const hint = this._overlay && this._overlay.querySelector('#vim-hint')
    if (ring) ring.classList.toggle('vim-pulsing', isListening)
    if (stopBtn) stopBtn.disabled = !isListening
    if (hint) hint.style.opacity = isListening ? '1' : '0'
  }

  _updateTranscriptDisplay(text) {
    const el = this._overlay && this._overlay.querySelector('#vim-transcript')
    if (el) el.textContent = text || ''
  }

  /* ─────────────── Waveform animation ─────────────── */

  _startWaveAnim() {
    const animate = () => {
      this._bars.forEach((bar) => {
        const h = Math.random() * 30 + 4
        bar.style.height = h + 'px'
        bar.style.opacity = String(0.4 + Math.random() * 0.6)
      })
      this._animTimer = setTimeout(() => {
        this._animFrame = requestAnimationFrame(animate)
      }, 80)
    }
    animate()
  }

  _stopWaveAnim() {
    if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null }
    if (this._animTimer) { clearTimeout(this._animTimer); this._animTimer = null }
    this._bars.forEach((bar) => {
      bar.style.height = '4px'
      bar.style.opacity = '0.3'
    })
  }

  /* ─────────────── Injected CSS ─────────────── */

  _injectStyles() {
    if (document.getElementById('vim-styles')) return
    const style = document.createElement('style')
    style.id = 'vim-styles'
    style.textContent = `
      #vim-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease;
      }
      #vim-overlay.vim-visible {
        opacity: 1;
        pointer-events: all;
      }
      #vim-modal {
        position: relative;
        background: linear-gradient(145deg, rgba(12,18,38,0.98) 0%, rgba(8,12,28,0.98) 100%);
        border: 1px solid rgba(79,158,255,0.3);
        border-radius: 24px;
        padding: 44px 36px 32px;
        width: 420px;
        max-width: 94vw;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        box-shadow:
          0 0 0 1px rgba(79,158,255,0.06),
          0 8px 64px rgba(0,0,0,0.75),
          0 0 80px rgba(79,158,255,0.1);
        transform: scale(0.9) translateY(16px);
        transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        font-family: 'DM Sans', system-ui, sans-serif;
      }
      #vim-overlay.vim-visible #vim-modal {
        transform: scale(1) translateY(0);
      }
      #vim-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 30px;
        height: 30px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.5);
        cursor: pointer;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
        line-height: 1;
      }
      #vim-close:hover {
        background: rgba(255,80,80,0.2);
        color: #ff8080;
        border-color: rgba(255,80,80,0.3);
      }
      #vim-icon-ring {
        position: relative;
        width: 84px;
        height: 84px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #vim-mic-icon {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(79,158,255,0.22) 0%, rgba(130,90,255,0.18) 100%);
        border: 2px solid rgba(79,158,255,0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #4f9eff;
        box-shadow: 0 0 32px rgba(79,158,255,0.28);
        position: relative;
        z-index: 1;
      }
      #vim-pulse-ring {
        position: absolute;
        inset: -10px;
        border-radius: 50%;
        border: 2px solid rgba(79,158,255,0.4);
        opacity: 0;
        transition: opacity 0.3s;
      }
      #vim-pulse-ring.vim-pulsing {
        opacity: 1;
        animation: vim-pulse 1.5s ease-out infinite;
      }
      @keyframes vim-pulse {
        0%   { transform: scale(1);    opacity: 0.75; }
        70%  { transform: scale(1.4);  opacity: 0;    }
        100% { transform: scale(1.4);  opacity: 0;    }
      }
      #vim-wave-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 44px;
        width: 100%;
      }
      .vim-bar {
        width: 3px;
        height: 4px;
        border-radius: 2px;
        background: linear-gradient(180deg, #4f9eff 0%, #8b5cf6 100%);
        opacity: 0.3;
        transition: height 0.08s ease, opacity 0.08s ease;
        flex-shrink: 0;
      }
      #vim-status {
        font-size: 0.88rem;
        font-weight: 600;
        color: rgba(255,255,255,0.65);
        letter-spacing: 0.01em;
        margin: 0;
      }
      #vim-hint {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.35);
        margin: -8px 0 0;
        transition: opacity 0.3s;
      }
      #vim-transcript {
        font-size: 0.96rem;
        color: rgba(255,255,255,0.9);
        text-align: center;
        line-height: 1.55;
        min-height: 52px;
        max-height: 130px;
        overflow-y: auto;
        padding: 10px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        width: 100%;
        box-sizing: border-box;
        word-break: break-word;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.15) transparent;
      }
      #vim-actions {
        display: flex;
        gap: 10px;
        width: 100%;
      }
      #vim-stop-btn {
        flex: 1;
        height: 40px;
        border: 1px solid rgba(79,158,255,0.45);
        border-radius: 10px;
        background: rgba(79,158,255,0.12);
        color: #4f9eff;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
      }
      #vim-stop-btn:hover:not(:disabled) {
        background: rgba(79,158,255,0.22);
        border-color: rgba(79,158,255,0.7);
        box-shadow: 0 0 16px rgba(79,158,255,0.22);
      }
      #vim-stop-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      #vim-clear-btn {
        height: 40px;
        padding: 0 20px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.5);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85rem;
        transition: background 0.18s, color 0.18s;
      }
      #vim-clear-btn:hover {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.85);
      }
    `
    document.head.appendChild(style)
  }
}

// Expose singleton so any page can call: window.voiceInputManager.start(inputEl)
window.voiceInputManager = new VoiceInputManager()
