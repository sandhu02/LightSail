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

async function generateWithOpenAITools({ apiKey, model, messages, tools }) {
  if (!apiKey) throw new Error('OpenAI API key is missing. Set it in Controls > AI Settings.')

  const selectedModel = model || 'gpt-4o'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const choice = data?.choices?.[0]
  const message = choice?.message

  if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
    const firstTool = message.tool_calls[0]
    let parsedArgs = {}
    try {
      parsedArgs = typeof firstTool.function.arguments === 'string'
        ? JSON.parse(firstTool.function.arguments)
        : firstTool.function.arguments || {}
    } catch (e) {
      parsedArgs = {}
    }

    return {
      type: 'tool_call',
      toolCallId: firstTool.id,
      toolName: firstTool.function.name,
      toolArgs: parsedArgs,
      rawResponse: data
    }
  }

  return {
    type: 'text',
    text: message?.content?.trim() || '',
    rawResponse: data
  }
}

module.exports = { generateWithOpenAI, generateWithOpenAITools }

