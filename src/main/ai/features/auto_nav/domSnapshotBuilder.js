/**
 * DOM Inspection Engine for Auto-Navigation Agent.
 * Executes JavaScript in the active tab to extract interactive elements
 * and inject visual index badges.
 */

const MAX_ELEMENTS = 75

/**
 * Removes all injected autonav markers and data attributes from the page.
 *
 * @param {Electron.WebContents} webContents
 * @returns {Promise<void>}
 */
async function cleanupMarkers(webContents) {
  if (!webContents || webContents.isDestroyed()) return
  try {
    await webContents.executeJavaScript(`(() => {
      document.querySelectorAll('[data-autonav-marker]').forEach(el => el.remove());
      document.querySelectorAll('[data-autonav-index]').forEach(el => el.removeAttribute('data-autonav-index'));
    })()`)
  } catch (err) {
    // Ignore errors if tab was navigated or destroyed
  }
}

/**
 * Executes JS in the target webContents and returns a structured DOM snapshot.
 *
 * @param {Electron.WebContents} webContents - The active tab's webContents
 * @returns {Promise<import('./autoNavTypes').DOMSnapshot>}
 */
async function buildDOMSnapshot(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    throw new Error('Target WebContents is not available or destroyed')
  }

  const snapshotScript = `(() => {
    // 1. Clean up any existing markers
    document.querySelectorAll('[data-autonav-marker]').forEach(el => el.remove());
    document.querySelectorAll('[data-autonav-index]').forEach(el => el.removeAttribute('data-autonav-index'));

    const selector = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="option"], [contenteditable="true"]';
    const allMatches = Array.from(document.querySelectorAll(selector));

    const visibleElements = [];

    for (const el of allMatches) {
      if (el.hasAttribute('data-autonav-marker') || el.closest('[data-autonav-marker]')) {
        continue;
      }

      // Check visibility
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      if (el.getAttribute('aria-hidden') === 'true') {
        continue;
      }

      visibleElements.push({ el, rect });
    }

    const totalVisible = visibleElements.length;
    const capped = visibleElements.slice(0, ${MAX_ELEMENTS});
    const isTruncated = totalVisible > ${MAX_ELEMENTS};

    const elementsData = [];

    // Create marker container fragment
    const markerFragment = document.createDocumentFragment();

    capped.forEach((item, index) => {
      const { el, rect } = item;
      el.setAttribute('data-autonav-index', String(index));

      // Inject visual marker badge
      const marker = document.createElement('div');
      marker.setAttribute('data-autonav-marker', 'true');
      marker.textContent = String(index);
      Object.assign(marker.style, {
        position: 'absolute',
        top: Math.max(0, rect.top + window.scrollY) + 'px',
        left: Math.max(0, rect.left + window.scrollX) + 'px',
        zIndex: '2147483647',
        backgroundColor: 'rgba(59, 130, 246, 0.92)',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        fontWeight: '700',
        lineHeight: '1.2',
        padding: '2px 5px',
        borderRadius: '3px',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
        userSelect: 'none'
      });
      markerFragment.appendChild(marker);

      const tag = el.tagName.toLowerCase();
      const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);

      elementsData.push({
        index,
        tag,
        role: el.getAttribute('role') || '',
        text,
        placeholder: el.getAttribute('placeholder') || '',
        value: el.value !== undefined ? String(el.value).slice(0, 60) : '',
        href: el.getAttribute('href') || '',
        type: el.getAttribute('type') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        disabled: Boolean(el.disabled),
        visible: true,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      });
    });

    if (document.body) {
      document.body.appendChild(markerFragment);
    }

    const bodyText = document.body ? (document.body.innerText || '').slice(0, 8000) : '';

    return {
      url: window.location.href || '',
      title: document.title || '',
      elements: elementsData,
      truncated: isTruncated,
      pageText: bodyText,
      scrollInfo: {
        scrollX: Math.round(window.scrollX || window.pageXOffset || 0),
        scrollY: Math.round(window.scrollY || window.pageYOffset || 0),
        scrollHeight: Math.round(document.documentElement.scrollHeight || (document.body ? document.body.scrollHeight : 0)),
        viewportHeight: Math.round(window.innerHeight || 0),
        viewportWidth: Math.round(window.innerWidth || 0)
      }
    };
  })()`

  return webContents.executeJavaScript(snapshotScript)
}

/**
 * Converts a DOMSnapshot object into compact, readable text for LLM consumption.
 *
 * @param {import('./autoNavTypes').DOMSnapshot} snapshot
 * @returns {string}
 */
function snapshotToText(snapshot) {
  if (!snapshot) return 'No snapshot available.'

  const lines = []
  lines.push(`Page: "${snapshot.title || 'Untitled'}" | URL: ${snapshot.url || 'about:blank'}`)
  const scroll = snapshot.scrollInfo || { scrollY: 0, scrollHeight: 0, viewportHeight: 0 }
  lines.push(`Scroll: ${scroll.scrollY}/${scroll.scrollHeight} (viewport ${scroll.viewportHeight}px)`)
  lines.push('')
  lines.push('Interactive elements:')

  if (!snapshot.elements || snapshot.elements.length === 0) {
    lines.push('(No visible interactive elements found on the page)')
  } else {
    for (const el of snapshot.elements) {
      let desc = `[${el.index}] <${el.tag}>`
      if (el.role) desc += ` role="${el.role}"`
      if (el.type) desc += ` type="${el.type}"`
      if (el.placeholder) desc += ` placeholder="${el.placeholder}"`
      if (el.value) desc += ` value="${el.value}"`
      if (el.href) desc += ` href="${el.href}"`
      if (el.ariaLabel) desc += ` aria-label="${el.ariaLabel}"`
      if (el.text) desc += ` "${el.text}"`
      if (el.disabled) desc += ` [disabled]`
      lines.push(desc)
    }
  }

  if (snapshot.truncated) {
    lines.push(`(Note: Interactive elements list truncated to first ${MAX_ELEMENTS} items)`)
  }

  lines.push('')
  lines.push('Visible text (first 4000 chars):')
  const bodyText = (snapshot.pageText || '').slice(0, 4000).trim()
  lines.push(bodyText || '(No visible text)')

  return lines.join('\n')
}

module.exports = {
  buildDOMSnapshot,
  snapshotToText,
  cleanupMarkers
}
