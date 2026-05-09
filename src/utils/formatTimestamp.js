export function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  
  // Check if today
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  
  // Check if yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  
  // Otherwise show full date
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  }) + `, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

