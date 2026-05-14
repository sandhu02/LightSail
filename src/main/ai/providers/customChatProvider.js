const { QUERY_URL } = require('../../../config/url')

async function customChatProvider(userPrompt, uid, session_id, pageContent ) {

    const response = await fetch(QUERY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'        
        },
        body: JSON.stringify(
            {
                "question": userPrompt, 
                "uid": uid,
                "session_id": session_id,
                "html": pageContent
            }
        )    
    })

    if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Request failed (${response.status}): ${errorBody}`)
    }

    const data = await response.json()
    return data
}


module.exports = { customChatProvider }