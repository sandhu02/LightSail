const { ipcMain, BrowserWindow } = require('electron')
const { AISettingsService } = require('./ai/settings/aiSettingsService')
const { AskAiService } = require('./ai/features/ask_ai/askAiService')
const { AutoNavService } = require('./ai/features/auto_nav/autoNavService')
const { AUTH_URL } = require('../config/url')

// Helper to extract text from Gemini Interactions API or generateContent response
function extractTextFromInteraction(data) {
  if (!data) return ''

  // 1. Direct string
  if (typeof data === 'string') return data.trim()

  // 2. Direct output_text or text property (SDKs or flattened responses)
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }
  if (typeof data.text === 'string' && data.text.trim()) {
    return data.text.trim()
  }

  // 3. Steps array (standard Interactions API REST response)
  // Structure: { steps: [ { type: "model_output", content: [ { type: "text", text: "..." } ] } ] }
  if (Array.isArray(data.steps) && data.steps.length > 0) {
    const parts = []
    for (const step of data.steps) {
      if (!step) continue

      // step.content may be an array, object, or string
      if (Array.isArray(step.content)) {
        for (const item of step.content) {
          if (!item) continue
          if (typeof item === 'string') {
            parts.push(item)
          } else if (typeof item.text === 'string') {
            parts.push(item.text)
          } else if (item.audioTranscription?.text) {
            parts.push(item.audioTranscription.text)
          } else if (item.audio_transcription?.text) {
            parts.push(item.audio_transcription.text)
          } else if (item.transcript) {
            parts.push(item.transcript)
          }
        }
      } else if (typeof step.content === 'string') {
        parts.push(step.content)
      } else if (step.content?.text) {
        parts.push(step.content.text)
      }

      // Direct properties on step
      if (typeof step.text === 'string') {
        parts.push(step.text)
      } else if (step.audioTranscription?.text) {
        parts.push(step.audioTranscription.text)
      } else if (step.audio_transcription?.text) {
        parts.push(step.audio_transcription.text)
      } else if (step.model_output?.text) {
        parts.push(step.model_output.text)
      } else if (Array.isArray(step.model_output?.content)) {
        for (const c of step.model_output.content) {
          if (c?.text) parts.push(c.text)
          if (c?.audioTranscription?.text) parts.push(c.audioTranscription.text)
        }
      }
    }
    const joined = parts.join(' ').trim()
    if (joined) return joined
  }

  // 4. Outputs array
  if (Array.isArray(data.outputs) && data.outputs.length > 0) {
    const parts = []
    for (const out of data.outputs) {
      if (typeof out === 'string') {
        parts.push(out)
      } else if (typeof out?.text === 'string') {
        parts.push(out.text)
      } else if (out?.audioTranscription?.text) {
        parts.push(out.audioTranscription.text)
      } else if (out?.audio_transcription?.text) {
        parts.push(out.audio_transcription.text)
      }
    }
    const joined = parts.join(' ').trim()
    if (joined) return joined
  }

  // 5. Candidates array (generateContent response)
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0]
    const parts = candidate?.content?.parts || []
    const texts = parts.map(p => p.text || p.audioTranscription?.text || '').filter(Boolean)
    if (texts.length > 0) return texts.join('\n').trim()
  }

  // 6. Deep search fallback: recursively find any 'text' or 'transcript' fields
  const collected = []
  function deepSearch(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 6) return
    for (const [key, val] of Object.entries(obj)) {
      if ((key === 'text' || key === 'transcript') && typeof val === 'string' && val.trim()) {
        collected.push(val.trim())
      } else if (typeof val === 'object' && val !== null) {
        deepSearch(val, depth + 1)
      }
    }
  }
  deepSearch(data)
  if (collected.length > 0) {
    return collected.join(' ').trim()
  }

  return ''
}

const TabManager = require('./TabsManager')

function getTabs(event, fallbackTabs) {
  if (event?.sender) {
    const manager = TabManager.forWebContents(event.sender)
    if (manager) return manager
  }
  return fallbackTabs || TabManager.instances.values().next().value || null
}

function registerIpcHandlers(defaultTabs, downloads) {
  const aiSettingsService = new AISettingsService()

  ipcMain.on('tab:create', (event, url) => getTabs(event, defaultTabs)?.createTab(url))
  ipcMain.on('tab:switch', (event, id) => getTabs(event, defaultTabs)?.switchTab(id))
  ipcMain.on('tab:close', (event, id) => getTabs(event, defaultTabs)?.closeTab(id))
  
  ipcMain.on('tab:navigate', (event, { id, url }) => {
    getTabs(event, defaultTabs)?.navigateTab(id, url)
  })

  ipcMain.handle('tab:get-ghost-state', (event) => {
    const tabs = getTabs(event, defaultTabs)
    const tab = tabs?.getTabByWebContentsId(event.sender.id)
    return {
      isGhost: Boolean(tab?.isGhost),
      tabId: tab?.id || null
    }
  })

  ipcMain.handle('tab:toggle-ghost-mode', (event) => {
    const tabs = getTabs(event, defaultTabs)
    const tab = tabs?.getTabByWebContentsId(event.sender.id)
    if (!tab) return { isGhost: false }
    const newGhost = !tab.isGhost
    tabs.setTabGhostMode(tab.id, newGhost)
    return { isGhost: newGhost, tabId: tab.id }
  })

  ipcMain.on('tab:navigate-ghost', (event, url) => {
    const tabs = getTabs(event, defaultTabs)
    const tab = tabs?.getTabByWebContentsId(event.sender.id)
    if (tab) {
      tabs.navigateTab(tab.id, url)
    }
  })

  ipcMain.handle('wallpaper:get', (event) => {
    const tabs = getTabs(event, defaultTabs)
    return tabs?.cachedWallpaper || 'home_wallpaper_3.jpg'
  })
  ipcMain.on('wallpaper:sync', (event, wp) => {
    if (wp && typeof wp === 'string') {
      for (const t of TabManager.instances.values()) {
        t.cachedWallpaper = wp
      }
    }
  })

  ipcMain.on('tab:back', (event, id) => getTabs(event, defaultTabs)?.goBack(id))
  ipcMain.on('tab:forward', (event, id) => getTabs(event, defaultTabs)?.goForward(id))
  
  ipcMain.on('tab:reload', (event, id) => getTabs(event, defaultTabs)?.tabs.get(id)?.view.webContents.reload())
  ipcMain.on('layout:update', (event, layout) => getTabs(event, defaultTabs)?.updateLayout(layout))

  const askAiServiceMap = new WeakMap()
  let defaultAskAiService = null

  function getAskAiService(tabs) {
    if (!tabs) {
      if (!defaultAskAiService) {
        defaultAskAiService = new AskAiService(tabs, aiSettingsService)
      }
      return defaultAskAiService
    }
    if (!askAiServiceMap.has(tabs)) {
      askAiServiceMap.set(tabs, new AskAiService(tabs, aiSettingsService))
    }
    const service = askAiServiceMap.get(tabs)
    service.tabs = tabs
    return service
  }

  ipcMain.handle('ai:ask', async (event, prompt, uid) => {
    const tabs = getTabs(event, defaultTabs)
    const askAiService = getAskAiService(tabs)
    return askAiService.ask(prompt, uid)
  })

  ipcMain.handle('ai:ask:reset', (event) => {
    const tabs = getTabs(event, defaultTabs)
    const askAiService = getAskAiService(tabs)
    askAiService.resetSession()
    return { ok: true }
  })
  ipcMain.handle('ai:settings:get', () => aiSettingsService.getSettingsForRenderer())
  ipcMain.handle('ai:settings:update', (_, settings) => aiSettingsService.updateSettings(settings))
  ipcMain.handle('ai:key:set', (_, { provider, apiKey }) => aiSettingsService.setApiKey(provider, apiKey))
  ipcMain.handle('ai:key:clear', (_, provider) => aiSettingsService.clearApiKey(provider))
  ipcMain.handle('ai:voice-settings:update', (_, settings) => aiSettingsService.updateVoiceSettings(settings))
  ipcMain.handle('ai:voice-key:set', (_, { provider, apiKey }) => aiSettingsService.setVoiceApiKey(provider, apiKey))
  ipcMain.handle('ai:voice-key:clear', (_, provider) => aiSettingsService.clearVoiceApiKey(provider))

  // Agent handlers
  let activeAutoNavService = null
  ipcMain.handle('agent:start', async (event, { prompt }) => {
    const tabs = getTabs(event, defaultTabs)
    const win = tabs?.win || BrowserWindow.fromWebContents(event.sender)
    activeAutoNavService = new AutoNavService(tabs, aiSettingsService, win)
    return activeAutoNavService.start(prompt)
  })
  ipcMain.on('agent:stop', () => activeAutoNavService?.stop())

  // Voice transcription (independent of Auto-Navigation and Ask AI)
  // Supports:
  // 1. OpenAI Whisper (whisper-1)
  // 2. Google Gemini (Files API + gemini-3.5-transcribe, fallback to generateContent)
  ipcMain.handle('voice:transcribe', async (_, { audioData, mimeType }) => {
    try {
      const voiceSettings = await aiSettingsService.getVoiceExecutionSettings()
      const provider = voiceSettings.provider || 'gemini'
      const model = voiceSettings.model
      const apiKey = voiceSettings.apiKey

      if (!apiKey) {
        const providerName = provider === 'openai' ? 'OpenAI' : 'Gemini'
        return { error: `No ${providerName} API key set for voice transcription. Go to Controls > AI Settings.` }
      }

      const audioBuffer = Buffer.from(audioData)
      if (!audioBuffer || audioBuffer.length === 0) {
        return { text: '' }
      }

      const rawMime = mimeType || 'audio/webm'
      const cleanMime = rawMime.split(';')[0].trim() || 'audio/webm'
      console.log(`[voice:transcribe] Processing audio via ${provider}: ${audioBuffer.length} bytes, mime: ${cleanMime}`)

      // ── Provider: OpenAI Whisper ──
      if (provider === 'openai') {
        const ext = cleanMime.includes('wav') ? 'wav' : cleanMime.includes('ogg') ? 'ogg' : cleanMime.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob([audioBuffer], { type: cleanMime })
        const formData = new FormData()
        formData.append('file', blob, `voice_recording.${ext}`)
        formData.append('model', model || 'whisper-1')

        console.log(`[voice:transcribe] Calling OpenAI Whisper API with model: ${model || 'whisper-1'}`)
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        })

        if (!response.ok) {
          const errText = await response.text()
          console.warn(`[voice:transcribe] OpenAI Whisper error (${response.status}):`, errText)
          let errMsg = `OpenAI Whisper transcription failed (${response.status})`
          try {
            const errJson = JSON.parse(errText)
            if (errJson.error?.message) errMsg = errJson.error.message
          } catch (_) {}
          return { error: errMsg }
        }

        const data = await response.json()
        const text = (data.text || '').trim()
        console.log('[voice:transcribe] OpenAI Whisper result:', text)
        return { text }
      }

      // ── Provider: Google Gemini ──
      let text = ''
      let fileUri = null
      let fileName = null

      // Step 1: Upload audio to Files API & run gemini-3.5-transcribe
      try {
        const boundary = `lightsail_audio_${Date.now()}`
        const metadataJson = JSON.stringify({ file: { displayName: 'voice_recording' } })

        const uploadBody = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metadataJson}\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Type: ${cleanMime}\r\n\r\n`),
          audioBuffer,
          Buffer.from(`\r\n--${boundary}--`)
        ])

        const uploadRes = await fetch(
          `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
            body: uploadBody
          }
        )

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          fileUri = uploadData.file?.uri
          fileName = uploadData.file?.name

          // Wait if file is in PROCESSING state
          let fileState = uploadData.file?.state
          let attempts = 0
          while (fileState === 'PROCESSING' && attempts < 10) {
            console.log(`[voice:transcribe] File ${fileName} is PROCESSING, waiting 500ms...`)
            await new Promise(resolve => setTimeout(resolve, 500))
            try {
              const checkRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(apiKey)}`
              )
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                fileState = checkData.state
                if (fileState === 'ACTIVE') break
              }
            } catch (_) {}
            attempts++
          }

          if (fileUri) {
            const interactionRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(apiKey)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'gemini-3.5-transcribe',
                  input: [
                    {
                      type: 'audio',
                      uri: fileUri,
                      mime_type: cleanMime
                    }
                  ],
                  generation_config: {
                    transcription_config: {
                      mode: 'smart'
                    }
                  }
                })
              }
            )

            if (interactionRes.ok) {
              const interactionData = await interactionRes.json()
              text = extractTextFromInteraction(interactionData)
              console.log('[voice:transcribe] gemini-3.5-transcribe parsed text:', text)
            } else {
              const errText = await interactionRes.text()
              console.warn(`[voice:transcribe] Interactions API failed (${interactionRes.status}):`, errText)
            }
          }
        } else {
          const errText = await uploadRes.text()
          console.warn(`[voice:transcribe] Files API upload failed (${uploadRes.status}):`, errText)
        }
      } catch (err) {
        console.warn('[voice:transcribe] Interactions flow error:', err.message)
      } finally {
        if (fileName) {
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(apiKey)}`,
            { method: 'DELETE' }
          ).catch(() => {})
        }
      }

      // Step 2: Fallback to generateContent with inline audio
      if (!text) {
        console.log('[voice:transcribe] Primary transcribe returned empty; falling back to generateContent with inline audio...')
        const base64Audio = audioBuffer.toString('base64')
        const candidateModels = [
          model || 'gemini-2.5-flash',
          'gemini-2.5-flash',
          'gemini-1.5-flash'
        ]
        const uniqueModels = [...new Set(candidateModels.filter(Boolean))]

        for (const mod of uniqueModels) {
          try {
            const normModel = mod.startsWith('gemini-') ? mod : `gemini-${mod}`
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [
                    {
                      inline_data: {
                        mime_type: cleanMime,
                        data: base64Audio
                      }
                    },
                    {
                      text: 'Transcribe the spoken speech in this audio accurately. Output ONLY the transcription text, nothing else. Do not add quotes, introductory text, explanations, or labels. If the audio contains only silence or inaudible noise, output nothing.'
                    }
                  ]
                }]
              })
            })

            if (response.ok) {
              const data = await response.json()
              const candidateText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n').trim() || ''
              if (candidateText) {
                text = candidateText
                console.log(`[voice:transcribe] generateContent (${normModel}) result:`, text)
                break
              }
            } else {
              console.warn(`[voice:transcribe] generateContent (${normModel}) error (${response.status}):`, await response.text())
            }
          } catch (modelErr) {
            console.warn(`[voice:transcribe] generateContent (${mod}) exception:`, modelErr.message)
          }
        }
      }

      console.log('[voice:transcribe] Final transcript result:', text)
      return { text }

    } catch (err) {
      console.error('[voice:transcribe] error:', err)
      return { error: err.message }
    }
  })


  ipcMain.handle('main:browsingHistory', (event) => getTabs(event, defaultTabs)?.getBrowsingHistory() || [])

  // Download handlers
  ipcMain.handle('downloads:getHistory', () => downloads.getHistory())
  ipcMain.handle('downloads:getActive', () => downloads.getActiveDownloads())
  ipcMain.handle('downloads:clearHistory', () => downloads.clearHistory())
  ipcMain.on('downloads:showFile', (_, filePath) => downloads.showFileInFolder(filePath))
  ipcMain.on('downloads:pause', (_, downloadId) => downloads.pauseDownload(downloadId))
  ipcMain.on('downloads:resume', (_, downloadId) => downloads.resumeDownload(downloadId))
  ipcMain.on('downloads:cancel', (_, downloadId) => downloads.cancelDownload(downloadId))



  ipcMain.on('auth:start', (event) => {
    const authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    authWindow.loadURL(AUTH_URL)

    authWindow.once('ready-to-show', () => {
      authWindow.show()
    })

    authWindow.webContents.on('dom-ready', async () => {
      try {
        const content = await authWindow.webContents.executeJavaScript('document.body.textContent')
        if (content.trim().startsWith('{')) {
          const data = JSON.parse(content)
          if (data.message === 'User authenticated successfully') {
            event.sender.send('auth:success', data)
            authWindow.close()
          } else {
            event.sender.send('auth:error', data.message || 'Authentication failed')
            authWindow.close()
          }
        }
      } catch (e) {
        // Ignore if not JSON yet
      }
    })

    authWindow.on('closed', () => {
      // If not handled, perhaps send error
    })
  })
}

module.exports = { registerIpcHandlers }