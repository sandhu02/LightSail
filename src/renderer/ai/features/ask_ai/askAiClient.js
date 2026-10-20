(function initAskAiClient() {
  window.askAiClient = {
    ask: async (prompt, uid = '') => {
      if (!window.ai?.ask) {
        throw new Error('AI bridge is unavailable.')
      }
      return window.ai.ask(prompt, uid)
    },
    resetSession: async () => {
      return window.ai?.resetAskSession?.()
    }
  }
})()