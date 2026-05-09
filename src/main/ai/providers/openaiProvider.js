async function generateWithOpenAI({ apiKey, model, systemPrompt, userPrompt }) {
  if (!apiKey) throw new Error('OpenAI API key is missing. Set it in Controls > AI Settings.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || '',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

module.exports = { generateWithOpenAI }
