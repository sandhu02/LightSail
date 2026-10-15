/**
 * Client-side Auto Navigate integration for the Ask AI side panel.
 */

(function () {
  const messages = document.getElementById('ask-ai-messages')
  const input = document.getElementById('ask-ai-input')
  const stopButton = document.getElementById('agent-stop-btn')
  const modeButton = document.getElementById('auto-nav-toggle')
  const statusBadge = document.getElementById('agent-status-badge')

  let isAgentRunning = false
  let runId = 0

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function updateStatus(status, summary, error) {
    const normalizedStatus = (status || 'idle').toLowerCase()
    if (statusBadge) {
      const labels = {
        running: 'Running',
        completed: 'Completed',
        stopped: 'Stopped',
        max_steps_reached: 'Max Steps',
        error: 'Error'
      }
      statusBadge.className = `agent-status-badge status-${normalizedStatus}`
      statusBadge.textContent = labels[normalizedStatus] || 'Idle'
    }

    isAgentRunning = normalizedStatus === 'running'
    if (input) input.disabled = isAgentRunning
    if (stopButton) stopButton.style.display = isAgentRunning ? 'inline-flex' : 'none'
    if (modeButton) modeButton.disabled = isAgentRunning

    if (summary || error || (normalizedStatus !== 'running' && normalizedStatus !== 'idle')) {
      showSummary(summary, error, normalizedStatus)
    }
  }

  function showSummary(summaryText, errorText, status) {
    if (!messages) return

    messages.querySelector('.agent-summary')?.remove()
    const isError = Boolean(errorText) || status === 'error'
    const text = errorText || summaryText || (status === 'completed' ? 'Goal successfully accomplished.' : '')
    if (!text) return

    const summary = document.createElement('div')
    summary.className = `agent-summary ${isError ? 'error-summary' : ''}`
    const icon = document.createElement('span')
    icon.className = 'agent-summary-icon'
    icon.textContent = isError ? '⚠️' : '🎉'
    const content = document.createElement('span')
    content.className = 'agent-summary-text'
    content.textContent = text
    summary.append(icon, content)
    messages.appendChild(summary)
    messages.scrollTop = messages.scrollHeight
  }

  function clearStepLog() {
    messages?.querySelectorAll('.agent-step, .agent-summary').forEach((element) => element.remove())
  }

  function renderOrUpdateStep(data) {
    if (!messages) return

    const stepId = `agent-run-${runId}-step-${data.step}`
    let stepEl = document.getElementById(stepId)
    const status = data.status || 'executing'
    let statusIcon = ''
    if (status === 'executing') {
      statusIcon = '<div class="step-spinner"></div>'
    } else if (status === 'done') {
      statusIcon = '<span class="step-done-icon">✓</span>'
    } else if (status === 'error') {
      statusIcon = '<span class="step-error-icon">✕</span>'
    } else if (status === 'thinking') {
      statusIcon = '<span class="step-thinking-icon">💭</span>'
    }

    let detailText = data.result || data.message || ''
    if (status === 'executing' && data.tool) {
      const args = data.args || {}
      const details = {
        click: `Clicking element [${args.index}]...`,
        type_text: `Typing "${args.text || ''}" into element [${args.index}]...`,
        navigate: `Navigating to ${args.url || ''}...`,
        scroll: `Scrolling ${args.direction || 'down'} ${args.amount || 500}px...`,
        wait: `Waiting ${args.milliseconds || 2000}ms...`,
        select_option: `Selecting option "${args.value}" in [${args.index}]...`,
        go_back: 'Navigating back...',
        done: args.summary || 'Task completed.'
      }
      detailText = details[data.tool] || detailText
    }

    if (!stepEl) {
      stepEl = document.createElement('div')
      stepEl.id = stepId
      stepEl.className = 'agent-step'
      messages.appendChild(stepEl)
    }

    stepEl.setAttribute('data-status', status)
    stepEl.innerHTML = `
      <div class="step-header">
        <span class="step-number">Step ${escapeHtml(data.step)}</span>
        ${data.tool ? `<span class="step-tool">${escapeHtml(data.tool)}</span>` : ''}
        <div class="step-status-icon">${statusIcon}</div>
      </div>
      <div class="step-detail">${escapeHtml(detailText)}</div>
    `
    messages.scrollTop = messages.scrollHeight
  }

  async function start(prompt) {
    if (!window.agent?.start) {
      throw new Error('Agent API is not available in window context.')
    }
    if (isAgentRunning) {
      throw new Error('Auto Navigate is already running.')
    }

    runId += 1
    clearStepLog()
    updateStatus('running')
    return window.agent.start(prompt)
  }

  function stop() {
    if (!window.agent?.stop) {
      throw new Error('Agent API is not available in window context.')
    }
    window.agent.stop()
    updateStatus('stopped', 'Navigation stopped by user.')
  }

  if (window.agent?.onStep) {
    window.agent.onStep(renderOrUpdateStep)
  }

  if (window.agent?.onStatus) {
    window.agent.onStatus((data) => {
      updateStatus(data.status, data.summary, data.error)
    })
  }

  window.autoNavClient = {
    start,
    stop,
    updateStatus,
    clearStepLog,
    isRunning: () => isAgentRunning
  }
})()
