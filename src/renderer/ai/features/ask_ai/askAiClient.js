(function initAskAiClient() {
  window.askAiClient = {
    ask: async (prompt) => {
      if (!window.ai?.ask) {
        throw new Error('AI bridge is unavailable.')
      }
      return window.ai.ask(prompt)
    }
  }
})()