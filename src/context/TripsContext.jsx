import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { generateId } from '../utils/id'
import { fetchMasterData } from '../services/masterData'
import { fetchTripRows, insertTripRow, insertTripRows, updateTripRow, deleteTripRow } from '../services/tripsApi'
import { markTripLoaded, rejectTripLoad, markTripInTransit } from '../services/tripActions'
import { dbRowToTrip, tripPatchToDbRow } from '../lib/tripsMapping'
import { useAuth } from './AuthContext'

const TripsContext = createContext(null)

function nowIso() {
  return new Date().toISOString()
}

export function TripsProvider({ children }) {
  const { currentUser, loading: authLoading } = useAuth()
  const [trips, setTrips] = useState([])
  const [masterData, setMasterData] = useState({ customers: [], transporters: [], warehouses: [], destinations: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Flags trips whose data just changed *in this session* (own writes only -- see the Phase 2
  // report on why this no longer fires for other tabs/devices the way the old localStorage
  // version did) so the UI can pulse a "live update" highlight.
  const [justUpdated, setJustUpdated] = useState(() => new Set())
  const prevTripsRef = useRef(trips)

  const pulseUpdated = useCallback((ids) => {
    setJustUpdated((prev) => new Set([...prev, ...ids]))
    setTimeout(() => {
      setJustUpdated((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    }, 3000)
  }, [])

  useEffect(() => {
    prevTripsRef.current = trips
  }, [trips])

  // By-id name lookups derived from whatever master data is currently loaded -- shared by
  // load()/createTrip()/importTrips()/updateTrip() so a trip's customer/transporter/warehouse
  // name is resolved consistently everywhere, including immediately after a create/edit
  // (not just after the next full reload).
  const makeNameResolver = useCallback((md) => {
    const customersById = new Map(md.customers.map((c) => [c.id, c.name]))
    const transportersById = new Map(md.transporters.map((t) => [t.id, t.name]))
    const warehousesById = new Map(md.warehouses.map((w) => [w.id, w.name]))
    return (row) => ({
      customerName: row.customer_id ? customersById.get(row.customer_id) ?? null : null,
      sourceWarehouseName: row.source_warehouse_id ? warehousesById.get(row.source_warehouse_id) ?? null : null,
      transporterName: row.transporter_id ? transportersById.get(row.transporter_id) ?? null : null,
    })
  }, [])

  const resolveNames = useMemo(() => makeNameResolver(masterData), [makeNameResolver, masterData])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [md, rows] = await Promise.all([fetchMasterData(), fetchTripRows()])
      setMasterData(md)
      const namesFor = makeNameResolver(md)
      setTrips(rows.map((row) => dbRowToTrip(row, namesFor(row))))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [makeNameResolver])

  // Phase 4: refreshes only the master-data lists (after an inline "+" creation in TripPanel)
  // without touching `trips` -- a full load() would be wasteful here and would also briefly
  // flip `loading`, which TransportationLog renders as a full-page loading state.
  const refreshMasterData = useCallback(async () => {
    const md = await fetchMasterData()
    setMasterData(md)
  }, [])

  // Fixes an intermittent "permission denied" race: this effect used to fire on mount
  // unconditionally, sometimes before supabase-js finished restoring the session/JWT from
  // storage, so the very first request(s) went out unauthenticated and got rejected by RLS --
  // randomly for whichever table's request lost the race. Waiting for AuthContext to confirm
  // a real logged-in user first guarantees the session is attached before any query fires.
  useEffect(() => {
    if (authLoading || !currentUser) return
    load()
  }, [authLoading, currentUser, load])

  const patchTrip = useCallback(
    (id, updater) => {
      setTrips((prev) => prev.map((trip) => (trip.id === id ? { ...trip, ...updater(trip) } : trip)))
    },
    [setTrips],
  )

  const addTimelineEvent = useCallback(
    (id, label, actor = 'System') => {
      patchTrip(id, (trip) => ({
        timeline: [...trip.timeline, { id: generateId('evt'), label, actor, timestamp: nowIso() }],
      }))
    },
    [patchTrip],
  )

  const getSalesNumbers = useCallback(() => trips.map((trip) => trip.salesNo), [trips])

  const isSalesNoTaken = useCallback(
    (salesNo, excludeId) =>
      trips.some(
        (trip) => trip.id !== excludeId && trip.salesNo.trim().toUpperCase() === salesNo.trim().toUpperCase(),
      ),
    [trips],
  )

  const createTrip = useCallback(
    async (data) => {
      const row = tripPatchToDbRow(data)
      const created = await insertTripRow(row)
      const trip = dbRowToTrip(created, resolveNames(created))
      setTrips((prev) => [trip, ...prev])
      return trip
    },
    [resolveNames],
  )

  const importTrips = useCallback(
    async (rows, { onProgress, chunkSize = 500 } = {}) => {
      const total = rows.length
      if (total === 0) return []

      const allCreated = []
      for (let index = 0; index < total; index += chunkSize) {
        const chunk = rows.slice(index, index + chunkSize).map(tripPatchToDbRow)
        // eslint-disable-next-line no-await-in-loop -- intentionally sequential: keeps each
        // insert a reasonable size and lets progress reporting reflect real completed work.
        const createdRows = await insertTripRows(chunk)
        allCreated.push(...createdRows)
        onProgress?.({ processed: Math.min(index + chunkSize, total), total })
      }

      const createdTrips = allCreated.map((row) => dbRowToTrip(row, resolveNames(row)))
      setTrips((prev) => [...createdTrips, ...prev])
      return createdTrips
    },
    [resolveNames],
  )

  const deleteTrip = useCallback(async (id) => {
    await deleteTripRow(id)
    setTrips((prev) => prev.filter((trip) => trip.id !== id))
  }, [])

  const updateTrip = useCallback(
    async (id, patch) => {
      const row = tripPatchToDbRow(patch)
      const updated = await updateTripRow(id, row)
      const trip = dbRowToTrip(updated, resolveNames(updated))
      setTrips((prev) => prev.map((t) => (t.id === id ? trip : t)))
      pulseUpdated([id])
      if (patch.status === 'delivered') {
        addTimelineEvent(id, 'Delivered to customer', 'S. Al-Qahtani')
      }
      return trip
    },
    [resolveNames, pulseUpdated, addTimelineEvent],
  )

  // Operational workflow (see 0016): the warehouse scanner matches trips at the two statuses a
  // warehouse employee actually acts on -- 'waiting_for_loading' (eligible for Loaded/Reject,
  // i.e. the transporter has already submitted driver/vehicle) and 'loaded' (eligible for In
  // Transit). Was 'ready_for_transporter' before mark_trip_loaded's eligibility check moved to
  // Waiting for Loading.
  const findTripByPlate = useCallback(
    (plate) => {
      const normalized = plate.trim().toUpperCase().replace(/\s+/g, '')
      if (!normalized) return null
      return trips.find(
        (trip) =>
          ['waiting_for_loading', 'loaded'].includes(trip.status) &&
          trip.plateNo.toUpperCase().replace(/\s+/g, '').includes(normalized),
      )
    },
    [trips],
  )

  // Mirrors findTripByPlate exactly, matching on Sales No instead -- the warehouse screen's
  // second search option (see 0013 item 3).
  const findTripBySalesNo = useCallback(
    (salesNo) => {
      const normalized = salesNo.trim().toUpperCase()
      if (!normalized) return null
      return trips.find(
        (trip) =>
          ['waiting_for_loading', 'loaded'].includes(trip.status) &&
          trip.salesNo.toUpperCase().includes(normalized),
      )
    },
    [trips],
  )

  // Phase 3: real Supabase persistence via the mark_trip_loaded/reject_trip_load RPCs (see
  // supabase/migrations/0007_trip_loading_rpc.sql, 0008_reject_status.sql) -- the RPC is the
  // sole write path, and its own server-side checks (identity/role/active-status/trip status)
  // are the real security boundary, not anything here. Neither function pushes an optimistic
  // timeline entry anymore -- TripPanel's Timeline tab now reads the real, durable
  // trip_events row instead, avoiding a duplicate local+real entry for the same action.
  const markLoaded = useCallback(
    async (id) => {
      const row = await markTripLoaded(id)
      const trip = dbRowToTrip(row, resolveNames(row))
      setTrips((prev) => prev.map((t) => (t.id === id ? trip : t)))
      pulseUpdated([id])
      return trip
    },
    [resolveNames, pulseUpdated],
  )

  // 0008: reject_trip_load now moves the trip to 'Rejected' (was previously audit-only, no
  // status change) and returns the updated row -- consumed the same way markLoaded consumes
  // its RPC's return value, so a rejection is reflected in local state immediately.
  const rejectLoad = useCallback(
    async (id, reason) => {
      const row = await rejectTripLoad(id, reason)
      const trip = dbRowToTrip(row, resolveNames(row))
      setTrips((prev) => prev.map((t) => (t.id === id ? trip : t)))
      pulseUpdated([id])
      return trip
    },
    [resolveNames, pulseUpdated],
  )

  // Operational workflow (see 0013): Loaded -> In Transit, mirrors markLoaded/rejectLoad exactly
  // -- the RPC re-validates identity/role/active-status/trip-status server-side.
  const markInTransit = useCallback(
    async (id) => {
      const row = await markTripInTransit(id)
      const trip = dbRowToTrip(row, resolveNames(row))
      setTrips((prev) => prev.map((t) => (t.id === id ? trip : t)))
      pulseUpdated([id])
      return trip
    },
    [resolveNames, pulseUpdated],
  )

  const setCustomFieldValue = useCallback(
    (id, columnId, fieldValue) => {
      patchTrip(id, (trip) => ({
        customFields: { ...(trip.customFields ?? {}), [columnId]: fieldValue },
      }))
    },
    [patchTrip],
  )

  const value = useMemo(
    () => ({
      trips,
      loading,
      error,
      reload: load,
      customers: masterData.customers,
      transporters: masterData.transporters,
      warehouses: masterData.warehouses,
      destinations: masterData.destinations,
      refreshMasterData,
      justUpdated,
      createTrip,
      importTrips,
      getSalesNumbers,
      isSalesNoTaken,
      deleteTrip,
      updateTrip,
      addTimelineEvent,
      findTripByPlate,
      findTripBySalesNo,
      markLoaded,
      rejectLoad,
      markInTransit,
      setCustomFieldValue,
    }),
    [
      trips,
      loading,
      error,
      load,
      masterData,
      refreshMasterData,
      justUpdated,
      createTrip,
      importTrips,
      getSalesNumbers,
      isSalesNoTaken,
      deleteTrip,
      updateTrip,
      addTimelineEvent,
      findTripByPlate,
      findTripBySalesNo,
      markLoaded,
      rejectLoad,
      markInTransit,
      setCustomFieldValue,
    ],
  )

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
}

export function useTrips() {
  const ctx = useContext(TripsContext)
  if (!ctx) throw new Error('useTrips must be used within TripsProvider')
  return ctx
}
