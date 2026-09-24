/**
 * Agent Orchestrator for Auto-Navigation Agent.
 * Runs the ReAct-style agentic loop (Observe -> Think -> Act -> Repeat).
 */

const { MAX_STEPS, AGENT_STATUS, STEP_STATUS } = require('./autoNavTypes')
const { TOOL_DEFINITIONS } = require('./toolDefinitions')
const { SYSTEM_PROMPT, buildStepPrompt, buildGoalPrompt } = require('./promptTemplates')
const { buildDOMSnapshot, snapshotToText, cleanupMarkers } = require('./domSnapshotBuilder')
const { ActionExecutor } = require('./actionExecutor')
const { generateWithTools } = require('../../core/llmGateway')

class AgentOrchestrator {
  /**
   * @param {Object} deps
   * @param {import('../../TabsManager')} deps.tabs              - TabManager instance
   * @param {import('../../settings/aiSettingsService').AISettingsService} deps.aiSettingsService  - For retrieving provider/key
   * @param {Function} deps.onStepUpdate      - Callback to send step updates to renderer
   * @param {Function} deps.onStatusChange    - Callback to send status changes to renderer
   */
  constructor({ tabs, aiSettingsService, executionSettings, onStepUpdate, onStatusChange }) {
    this.tabs = tabs
    this.aiSettingsService = aiSettingsService
    this.executionSettings = executionSettings || null
    this.onStepUpdate = onStepUpdate || (() => {})
    this.onStatusChange = onStatusChange || (() => {})
    this.aborted = false
    this.status = AGENT_STATUS.IDLE
  }

  /**
   * Gracefully stops the running agent loop.
   */
  stop() {
    this.aborted = true
  }

  /**
   * Starts the autonomous navigation agent loop.
   *
   * @param {string} prompt - User's natural-language goal
   * @returns {Promise<import('./autoNavTypes').AgentResult>}
   */
  async run(prompt) {
    const webContents = this.tabs.getActiveWebContents()
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('No active browser tab found to navigate')
    }

    this.aborted = false
    this.status = AGENT_STATUS.RUNNING
    this.onStatusChange({ status: AGENT_STATUS.RUNNING })

    // Handler for dismissing alert/confirm/prompt dialogs automatically
    const onDialog = (event, dialog) => {
      try {
        event.preventDefault()
        dialog.dismiss()
      } catch (err) {}
    }
    const onWillPreventUnload = (event) => {
      try {
        event.preventDefault()
      } catch (err) {}
    }

    try {
      webContents.on('dialog', onDialog)
    } catch (e) {}
    try {
      webContents.on('will-prevent-unload', onWillPreventUnload)
    } catch (e) {}

    const executor = new ActionExecutor(webContents)
    let stepCount = 0
    let finalSummary = ''
    let runError = null

    const conversationHistory = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildGoalPrompt(prompt) }
    ]

    try {
      await cleanupMarkers(webContents)

      while (!this.aborted && stepCount < MAX_STEPS) {
        const currentStep = stepCount + 1

        // 1. Observe: Capture DOM snapshot
        let snapshot = null
        try {
          snapshot = await buildDOMSnapshot(webContents)
        } catch (err) {
          if (this.aborted) break
          // If page was loading or transitioning, wait briefly and retry once
          await new Promise(r => setTimeout(r, 1200))
          if (this.aborted) break
          try {
            snapshot = await buildDOMSnapshot(webContents)
          } catch (retryErr) {
            runError = `Failed to inspect page: ${retryErr.message}`
            break
          }
        }

        if (this.aborted) break

        const snapshotText = snapshotToText(snapshot)
        conversationHistory.push({
          role: 'user',
          content: buildStepPrompt(currentStep, snapshotText)
        })

        // 2. Think: Call LLM with tool definitions
        this.onStepUpdate({
          step: currentStep,
          status: STEP_STATUS.THINKING,
          message: 'Analyzing page and deciding next action...',
          timestamp: Date.now()
        })

        let executionSettings = this.executionSettings
        if (!executionSettings) {
          try {
            const raw = await this.aiSettingsService.getExecutionSettings()
            if (raw.provider === 'openai' || raw.provider === 'gemini') {
              executionSettings = raw
            } else {
              const geminiKey = await this.aiSettingsService.secretsStore.getApiKey('gemini')
              if (geminiKey) {
                const geminiModel = this.aiSettingsService.settingsStore?.getModelForProvider?.('gemini') || raw.model || 'gemini-2.5-flash'
                executionSettings = { provider: 'gemini', model: geminiModel, apiKey: geminiKey }
              } else {
                const openaiKey = await this.aiSettingsService.secretsStore.getApiKey('openai')
                if (openaiKey) {
                  const openaiModel = this.aiSettingsService.settingsStore?.getModelForProvider?.('openai') || raw.model || 'gpt-4.1-mini'
                  executionSettings = { provider: 'openai', model: openaiModel, apiKey: openaiKey }
                } else {
                  throw new Error('Auto-Navigation requires Gemini or OpenAI. Please set an API key in Controls > AI Settings.')
                }
              }
            }
          } catch (err) {
            runError = `Failed to get AI settings: ${err.message}`
            break
          }
        }

        let llmResponse
        try {
          llmResponse = await generateWithTools({
            settings: executionSettings,
            messages: conversationHistory,
            tools: TOOL_DEFINITIONS
          })
        } catch (err) {
          runError = `AI provider error: ${err.message}`
          this.onStepUpdate({
            step: currentStep,
            status: STEP_STATUS.ERROR,
            result: runError,
            timestamp: Date.now()
          })
          break
        }

        if (this.aborted) break

        // 3. Act: Execute tool or handle thinking
        if (llmResponse.type === 'tool_call') {
          const toolName = llmResponse.toolName
          const toolArgs = llmResponse.toolArgs || {}
          const toolCallId = llmResponse.toolCallId || `call_${Date.now()}_${stepCount}`

          this.onStepUpdate({
            step: currentStep,
            tool: toolName,
            args: toolArgs,
            status: STEP_STATUS.EXECUTING,
            timestamp: Date.now()
          })

          const actionResult = await executor.execute(toolName, toolArgs)

          conversationHistory.push({
            role: 'assistant',
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: {
                name: toolName,
                arguments: JSON.stringify(toolArgs)
              }
            }]
          })

          conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: JSON.stringify(actionResult)
          })

          const isSuccess = Boolean(actionResult.success)
          const resultText = actionResult.message || (actionResult.error ? `Error: ${actionResult.error}` : 'Success')

          this.onStepUpdate({
            step: currentStep,
            tool: toolName,
            args: toolArgs,
            result: resultText,
            status: isSuccess ? STEP_STATUS.DONE : STEP_STATUS.ERROR,
            timestamp: Date.now()
          })

          if (toolName === 'done') {
            this.status = AGENT_STATUS.COMPLETED
            finalSummary = toolArgs.summary || resultText
            stepCount++
            break
          }

          // Allow the page time to respond to user action (load, re-render, AJAX)
          await new Promise(r => setTimeout(r, 1500))
        } else {
          // Plain text response from LLM
          conversationHistory.push({
            role: 'assistant',
            content: llmResponse.text || ''
          })

          this.onStepUpdate({
            step: currentStep,
            message: llmResponse.text || '',
            status: STEP_STATUS.THINKING,
            timestamp: Date.now()
          })
        }

        stepCount++
      }

      if (this.aborted) {
        this.status = AGENT_STATUS.STOPPED
      } else if (runError) {
        this.status = AGENT_STATUS.ERROR
      } else if (this.status !== AGENT_STATUS.COMPLETED && stepCount >= MAX_STEPS) {
        this.status = AGENT_STATUS.MAX_STEPS_REACHED
        finalSummary = `Reached maximum limit of ${MAX_STEPS} steps.`
      }
    } finally {
      // Clean up event listeners and markers
      try {
        webContents.removeListener('dialog', onDialog)
      } catch (e) {}
      try {
        webContents.removeListener('will-prevent-unload', onWillPreventUnload)
      } catch (e) {}
      await cleanupMarkers(webContents)
    }

    let finalUrl = ''
    let finalTitle = ''
    try {
      if (!webContents.isDestroyed()) {
        finalUrl = webContents.getURL() || ''
        finalTitle = webContents.getTitle() || ''
      }
    } catch (e) {}

    this.onStatusChange({
      status: this.status,
      summary: finalSummary || undefined,
      error: runError || undefined
    })

    return {
      status: this.status,
      totalSteps: stepCount,
      finalUrl,
      finalTitle,
      summary: finalSummary || undefined,
      error: runError || undefined
    }
  }
}

module.exports = { AgentOrchestrator }
