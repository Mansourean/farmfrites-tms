const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return dateFormatter.format(new Date(dateStr))
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return dateTimeFormatter.format(new Date(dateStr))
}
