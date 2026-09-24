/**
 * Client-side script for Auto-Navigation Agent Panel UI.
 * Handles user interactions, binds to window.agent IPC, and renders steps/status.
 */

(function () {
  const agentPanel = document.getElementById('agent-panel')
  const agentForm = document.getElementById('agent-form')
  const agentInput = document.getElementById('agent-input')
  const agentRunBtn = document.getElementById('agent-run-btn')
  const agentStopBtn = document.getElementById('agent-stop-btn')
  const agentStepLog = document.getElementById('agent-step-log')
  const agentSummary = document.getElementById('agent-summary')
  const agentStatusBadge = document.getElementById('agent-status-badge')
  const agentCloseBtn = document.getElementById('agent-panel-close')

  let isAgentRunning = false

  function updateStatus(status, summary, error) {
    if (!agentStatusBadge) return

    const normalizedStatus = (status || 'idle').toLowerCase()
    agentStatusBadge.className = `agent-status-badge status-${normalizedStatus}`

    let label = 'Idle'
    switch (normalizedStatus) {
      case 'running':
        label = 'Running'
        break
      case 'completed':
        label = 'Completed'
        break
      case 'stopped':
        label = 'Stopped'
        break
      case 'max_steps_reached':
        label = 'Max Steps'
        break
      case 'error':
        label = 'Error'
        break
      default:
        label = 'Idle'
    }

    agentStatusBadge.textContent = label

    isAgentRunning = normalizedStatus === 'running'

    if (agentInput) {
      agentInput.disabled = isAgentRunning
    }
    if (agentRunBtn) {
      agentRunBtn.style.display = isAgentRunning ? 'none' : 'inline-flex'
      agentRunBtn.disabled = isAgentRunning
    }
    if (agentStopBtn) {
      agentStopBtn.style.display = isAgentRunning ? 'inline-flex' : 'none'
    }

    if (summary || error || (normalizedStatus !== 'running' && normalizedStatus !== 'idle')) {
      showSummary(summary, error, normalizedStatus)
    }
  }

  function showSummary(summaryText, errorText, status) {
    if (!agentSummary) return
    const isError = Boolean(errorText) || status === 'error'
    const text = errorText || summaryText || (status === 'completed' ? 'Goal successfully accomplished.' : '')

    if (!text) {
      agentSummary.style.display = 'none'
      agentSummary.innerHTML = ''
      return
    }

    agentSummary.className = `agent-summary ${isError ? 'error-summary' : ''}`
    agentSummary.style.display = 'flex'
    agentSummary.innerHTML = `
      <div class="agent-summary-icon">${isError ? '⚠️' : '🎉'}</div>
      <div class="agent-summary-text">${escapeHtml(text)}</div>
    `
    if (agentStepLog) {
      agentStepLog.scrollTop = agentStepLog.scrollHeight
    }
  }

  function clearStepLog() {
    if (!agentStepLog) return
    agentStepLog.innerHTML = ''
    if (agentSummary) {
      agentSummary.style.display = 'none'
      agentSummary.innerHTML = ''
    }
  }

  function escapeHtml(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function renderOrUpdateStep(data) {
    if (!agentStepLog) return

    // Remove empty state if present
    const emptyState = agentStepLog.querySelector('.agent-empty-state')
    if (emptyState) emptyState.remove()

    const stepId = `agent-step-${data.step}`
    let stepEl = document.getElementById(stepId)

    const status = data.status || 'executing'
    let statusIcon = ''
    if (status === 'executing') {
      statusIcon = '<div class="step-spinner"></div>'
    } else if (status === 'done') {
      statusIcon = '<span style="color: #10b981;">✓</span>'
    } else if (status === 'error') {
      statusIcon = '<span style="color: #ef4444;">✕</span>'
    } else if (status === 'thinking') {
      statusIcon = '<span style="color: #f59e0b;">💭</span>'
    }

    let detailText = data.result || data.message || ''
    if (status === 'executing' && data.tool) {
      if (data.tool === 'click') {
        detailText = `Clicking element [${data.args?.index}]...`
      } else if (data.tool === 'type_text') {
        detailText = `Typing "${data.args?.text || ''}" into element [${data.args?.index}]...`
      } else if (data.tool === 'navigate') {
        detailText = `Navigating to ${data.args?.url || ''}...`
      } else if (data.tool === 'scroll') {
        detailText = `Scrolling ${data.args?.direction || 'down'} ${data.args?.amount || 500}px...`
      } else if (data.tool === 'wait') {
        detailText = `Waiting ${data.args?.milliseconds || 2000}ms...`
      } else if (data.tool === 'select_option') {
        detailText = `Selecting option "${data.args?.value}" in [${data.args?.index}]...`
      } else if (data.tool === 'go_back') {
        detailText = 'Navigating back...'
      } else if (data.tool === 'done') {
        detailText = data.args?.summary || 'Task completed.'
      }
    }

    if (!stepEl) {
      stepEl = document.createElement('div')
      stepEl.id = stepId
      stepEl.className = 'agent-step'
      stepEl.setAttribute('data-status', status)
      stepEl.innerHTML = `
        <div class="step-header">
          <span class="step-number">Step ${data.step}</span>
          ${data.tool ? `<span class="step-tool">${escapeHtml(data.tool)}</span>` : ''}
          <div class="step-status-icon">${statusIcon}</div>
        </div>
        <div class="step-detail">${escapeHtml(detailText)}</div>
      `
      agentStepLog.appendChild(stepEl)
    } else {
      stepEl.setAttribute('data-status', status)
      const toolBadge = data.tool ? `<span class="step-tool">${escapeHtml(data.tool)}</span>` : ''
      stepEl.innerHTML = `
        <div class="step-header">
          <span class="step-number">Step ${data.step}</span>
          ${toolBadge}
          <div class="step-status-icon">${statusIcon}</div>
        </div>
        <div class="step-detail">${escapeHtml(detailText)}</div>
      `
    }

    agentStepLog.scrollTop = agentStepLog.scrollHeight
  }

  // Handle form submission
  agentForm?.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (isAgentRunning || !agentInput) return

    const prompt = agentInput.value.trim()
    if (!prompt) return

    clearStepLog()
    updateStatus('running')

    try {
      if (window.agent?.start) {
        const result = await window.agent.start(prompt)
        updateStatus(result.status, result.summary, result.error)
      } else {
        throw new Error('Agent API is not available in window context.')
      }
    } catch (err) {
      updateStatus('error', null, err.message)
    }
  })

  // Enter to submit (Shift+Enter for newline)
  agentInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      agentForm?.dispatchEvent(new Event('submit'))
    }
  })

  // Handle stop button
  agentStopBtn?.addEventListener('click', () => {
    if (window.agent?.stop) {
      window.agent.stop()
    }
    updateStatus('stopped', 'Navigation stopped by user.')
  })

  // Close button
  agentCloseBtn?.addEventListener('click', () => {
    if (window.setAgentOpen) {
      window.setAgentOpen(false)
    } else {
      const app = document.getElementById('app')
      app?.classList.remove('agent-open')
      agentPanel?.setAttribute('aria-hidden', 'true')
    }
  })

  // Listen to IPC events from main process
  if (window.agent?.onStep) {
    window.agent.onStep((data) => {
      renderOrUpdateStep(data)
    })
  }

  if (window.agent?.onStatus) {
    window.agent.onStatus((data) => {
      updateStatus(data.status, data.summary, data.error)
    })
  }

  // Export helper functions to window if needed
  window.autoNavClient = {
    updateStatus,
    clearStepLog
  }
})()
