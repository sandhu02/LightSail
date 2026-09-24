function normalizeGeminiModel(model) {
  let selected = String(model || 'gemini-2.5-flash').trim()
  if (selected && !selected.startsWith('gemini-') && !selected.startsWith('models/')) {
    selected = `gemini-${selected}`
  }
  return selected
}

async function generateWithGemini({ apiKey, model, systemPrompt, userPrompt }) {
  if (!apiKey) throw new Error('Gemini API key is missing. Set it in Controls > AI Settings.')

  const selectedModel = normalizeGeminiModel(model)
  console.log(`[Gemini Provider] Requesting model: ${selectedModel}`)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }]
      },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text).join('\n').trim()
  return text || ''
}

function deepConvertTypesToUppercase(schema) {
  if (!schema || typeof schema !== 'object') return schema
  const copy = Array.isArray(schema) ? [] : {}
  for (const [key, val] of Object.entries(schema)) {
    if (key === 'type' && typeof val === 'string') {
      copy[key] = val.toUpperCase()
    } else if (typeof val === 'object' && val !== null) {
      copy[key] = deepConvertTypesToUppercase(val)
    } else {
      copy[key] = val
    }
  }
  return copy
}

function convertToolsToGemini(tools = []) {
  const declarations = tools.map(t => {
    const fn = t.function || t
    const cleanParams = deepConvertTypesToUppercase(fn.parameters || { type: 'object', properties: {} })
    return {
      name: fn.name,
      description: fn.description || '',
      parameters: cleanParams
    }
  })
  return [{ functionDeclarations: declarations }]
}

function convertMessagesToGemini(messages = []) {
  let systemInstruction = null
  const contents = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = {
        role: 'system',
        parts: [{ text: msg.content || '' }]
      }
      continue
    }

    if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content || '' }]
      })
      continue
    }

    if (msg.role === 'assistant') {
      const parts = []
      if (msg.content) {
        parts.push({ text: msg.content })
      }
      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let args = {}
          try {
            args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments || {}
          } catch (e) {
            args = {}
          }
          parts.push({
            functionCall: {
              name: tc.function.name,
              args
            }
          })
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts })
      }
      continue
    }

    if (msg.role === 'tool') {
      let parsedResponse = {}
      try {
        parsedResponse = typeof msg.content === 'string'
          ? JSON.parse(msg.content)
          : msg.content
      } catch (e) {
        parsedResponse = { content: msg.content }
      }
      if (typeof parsedResponse !== 'object' || parsedResponse === null) {
        parsedResponse = { result: parsedResponse }
      }

      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.name || 'tool_response',
            response: parsedResponse
          }
        }]
      })
    }
  }

  return { systemInstruction, contents }
}

async function generateWithGeminiTools({ apiKey, model, messages, tools }) {
  if (!apiKey) throw new Error('Gemini API key is missing. Set it in Controls > AI Settings.')

  const selectedModel = normalizeGeminiModel(model)
  console.log(`[Gemini Provider] Auto-Nav requesting model: ${selectedModel}`)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const { systemInstruction, contents } = convertMessagesToGemini(messages)
  const geminiTools = convertToolsToGemini(tools)

  const requestBody = {
    contents,
    tools: geminiTools
  }

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const candidate = data?.candidates?.[0]
  if (!candidate) {
    throw new Error('No candidate response received from Gemini')
  }

  const parts = candidate.content?.parts || []
  const functionCallPart = parts.find(p => p.functionCall)

  if (functionCallPart && functionCallPart.functionCall) {
    return {
      type: 'tool_call',
      toolCallId: 'call_' + Math.random().toString(36).slice(2, 10),
      toolName: functionCallPart.functionCall.name,
      toolArgs: functionCallPart.functionCall.args || {},
      rawResponse: data
    }
  }

  const text = parts.map(p => p.text || '').join('\n').trim()
  return {
    type: 'text',
    text,
    rawResponse: data
  }
}

module.exports = { generateWithGemini, generateWithGeminiTools }

