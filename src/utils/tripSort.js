// 'rejected' ranks above 'planned' -- a rejected trip needs immediate transportation-team
// follow-up (re-dispatch, new driver, etc.), so it must surface at the very top of the log,
// not settle near Delivered/Cancelled where it would be easy to miss.
const STATUS_RANK = {
  rejected: 0,
  planned: 1,
  ready_for_transporter: 2,
  waiting_driver: 3,
  loaded: 4,
  in_transit: 5,
  delivered: 6,
  cancelled: 7,
}

function createdRank(trip) {
  // Prefer the numeric creation sequence (always monotonic, immune to the demo data's
  // fictional dates). Fall back to the first timeline timestamp for older records.
  if (typeof trip.createdSeq === 'number') return trip.createdSeq
  return new Date(trip.timeline?.[0]?.timestamp ?? trip.dispatchDate).getTime()
}

function deliveredAt(trip) {
  const event = [...(trip.timeline ?? [])].reverse().find((e) => /deliver/i.test(e.label))
  return new Date(event?.timestamp ?? trip.deliveryDate).getTime()
}

/**
 * Planned and In Transit trips always sit above Delivered ones, newest first within
 * each group, so new trips land at the top and delivered trips settle at the bottom.
 */
export function sortTrips(trips) {
  return [...trips].sort((a, b) => {
    const rankA = STATUS_RANK[a.status] ?? 0
    const rankB = STATUS_RANK[b.status] ?? 0
    if (rankA !== rankB) return rankA - rankB

    if (rankA === STATUS_RANK.delivered) {
      return deliveredAt(b) - deliveredAt(a)
    }
    return createdRank(b) - createdRank(a)
  })
}
