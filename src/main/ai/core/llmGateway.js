const { generateWithOpenAI, generateWithOpenAITools } = require('../providers/openaiProvider')
const { generateWithGemini, generateWithGeminiTools } = require('../providers/geminiProvider')
const { customChatProvider } = require('../providers/customChatProvider')

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

async function generateWithTools({ settings, messages, tools }) {
  const provider = settings.provider || 'gemini'
  const model = settings.model
  const apiKey = settings.apiKey || ''

  if (provider === 'openai') {
    return generateWithOpenAITools({ apiKey, model, messages, tools })
  }

  if (provider === 'gemini') {
    return generateWithGeminiTools({ apiKey, model, messages, tools })
  }

  throw new Error(`Unsupported AI provider for tool calling: "${provider}". Auto-Navigation requires Gemini or OpenAI. Please set a Gemini or OpenAI API key in Controls > AI Settings.`)
}

module.exports = { generateLLMResponse, generateWithTools }

