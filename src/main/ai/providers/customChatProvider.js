const { QUERY_URL } = require('../../../config/url')

async function customChatProvider(userPrompt, uid, session_id, pageContent) {
    if (!uid || uid === 'null' || uid === 'undefined' || String(uid).trim() === '') {
        uid = '101342610872240630560'
    }

    let response
    try {
        response = await fetch(QUERY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'        
            },
            body: JSON.stringify({
                question: userPrompt, 
                uid: String(uid).trim(),
                session_id: session_id || '',
                html: pageContent || ''
            })    
        })
    } catch (networkError) {
        throw new Error(`Unable to connect to backend server at ${QUERY_URL}. Please ensure the server is running on port 8000. (${networkError.message})`)
    }

    if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Backend server request failed (${response.status}): ${errorBody}`)
    }

    const data = await response.json()
    return data
}


module.exports = { customChatProvider }