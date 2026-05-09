const { generateWithOpenAI } = require('../providers/openaiProvider')
const { generateWithGemini } = require('../providers/geminiProvider')

async function generateLLMResponse({ settings, systemPrompt, userPrompt }) {
  const provider = settings.provider || 'gemini'
  const model = settings.model
  const apiKey = settings.apiKey || ''

  if (provider === 'openai') {
    return generateWithOpenAI({ apiKey, model, systemPrompt, userPrompt })
  }

  if (provider === 'gemini') {
    return generateWithGemini({ apiKey, model, systemPrompt, userPrompt })
  }

  throw new Error(`Unsupported AI provider: ${provider}`)
}

module.exports = { generateLLMResponse }
