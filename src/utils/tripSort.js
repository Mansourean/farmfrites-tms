const STATUS_RANK = { planned: 0, in_transit: 1, delivered: 2 }

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
