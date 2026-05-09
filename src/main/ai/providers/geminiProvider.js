async function generateWithGemini({ apiKey, model, systemPrompt, userPrompt }) {
  if (!apiKey) throw new Error('Gemini API key is missing. Set it in Controls > AI Settings.')

  const selectedModel = model || 'gemini-2.5-flash'
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

module.exports = { generateWithGemini }
