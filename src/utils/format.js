// timeZone: 'UTC' is required here, not cosmetic: dispatchDate/deliveryDate are plain calendar
// dates (YYYY-MM-DD, no meaningful time-of-day -- see tripsMapping.js's dateToDb/dateFromDb),
// but `new Date('2026-08-14')` parses that as 2026-08-14T00:00:00 *UTC*. Without pinning the
// formatter to UTC too, Intl.DateTimeFormat renders that instant in the *browser's local*
// timezone by default -- for any viewer west of UTC that rolls back to the previous calendar
// day (e.g. 14 Aug displays as "13 Aug"), which is exactly the off-by-one previously reported
// against the Loading Date calculation. The subtraction itself (suggestedDispatchDate) was
// already correct and fully UTC-safe; this was purely a display-layer bug, reproducible for
// any viewer whose system timezone is behind UTC, regardless of what was actually stored.
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
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
