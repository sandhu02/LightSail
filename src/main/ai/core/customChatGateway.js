const  { customChatProvider } = require('../providers/customChatProvider')

async function generateCustomChatResponse(userPrompt, uid, session_id, pageContent ) {

    return await customChatProvider(userPrompt, uid, session_id, pageContent )
}

module.exports = { generateCustomChatResponse }