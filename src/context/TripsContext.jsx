import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { initialTrips } from '../data/trips'
import { generateId, generateToken } from '../utils/id'

const TripsContext = createContext(null)

function nowIso() {
  return new Date().toISOString()
}

export function TripsProvider({ children }) {
  const [trips, setTrips] = useLocalStorage('ff-tms-trips', initialTrips)

  // Flags trips whose data just changed (locally or synced in from another tab, e.g.
  // a transporter submitting the WhatsApp form) so the UI can pulse a "live update" highlight.
  const [justUpdated, setJustUpdated] = useState(() => new Set())
  const prevTripsRef = useRef(trips)

  useEffect(() => {
    const prevById = new Map(prevTripsRef.current.map((t) => [t.id, t]))
    const changedIds = trips.filter((trip) => {
      const prev = prevById.get(trip.id)
      return prev && prev !== trip
    }).map((trip) => trip.id)
    prevTripsRef.current = trips

    if (changedIds.length === 0) return

    setJustUpdated((prev) => new Set([...prev, ...changedIds]))
    const timer = setTimeout(() => {
      setJustUpdated((prev) => {
        const next = new Set(prev)
        changedIds.forEach((id) => next.delete(id))
        return next
      })
    }, 3000)
    return () => clearTimeout(timer)
  }, [trips])

  const patchTrip = useCallback(
    (id, updater) => {
      setTrips((prev) =>
        prev.map((trip) => (trip.id === id ? { ...trip, ...updater(trip) } : trip)),
      )
    },
    [setTrips],
  )

  const addTimelineEvent = useCallback(
    (id, label, actor = 'System') => {
      patchTrip(id, (trip) => ({
        timeline: [
          ...trip.timeline,
          { id: generateId('evt'), label, actor, timestamp: nowIso() },
        ],
      }))
    },
    [patchTrip],
  )

  const createTrip = useCallback(
    (data) => {
      const id = generateId('trip')
      const trip = {
        id,
        // Sales No is the business key from Sales/SAP/ERP — it is never generated or
        // auto-incremented here, only ever taken from what the user (or an import) provides.
        salesNo: data.salesNo,
        tripType: data.tripType,
        customerId: data.tripType === 'customer' ? data.customerId : null,
        sourceWarehouseId: data.sourceWarehouseId,
        destinationWarehouseId: data.tripType === 'internal' ? data.destinationWarehouseId : null,
        destination: data.destination,
        loadTons: data.loadTons,
        transporterId: data.transporterId,
        driver: data.driver ?? null,
        plateNo: data.plateNo ?? '',
        vehicleType: data.vehicleType ?? '',
        dispatchDate: data.dispatchDate,
        deliveryDate: data.deliveryDate,
        status: 'planned',
        remarks: data.remarks ?? '',
        documents: [],
        timeline: [{ id: generateId('evt'), label: 'Trip created', actor: 'S. Al-Qahtani', timestamp: nowIso() }],
        whatsapp: null,
        // Always exceeds any seed trip's sequence number, so new trips sort first.
        createdSeq: Date.now(),
      }
      setTrips((prev) => [trip, ...prev])
      return trip
    },
    [setTrips],
  )

  // Every current Sales No, used by the Excel importer (and manual Create/Edit forms) to
  // flag duplicates before saving.
  const getSalesNumbers = useCallback(() => trips.map((trip) => trip.salesNo), [trips])

  const isSalesNoTaken = useCallback(
    (salesNo, excludeId) =>
      trips.some(
        (trip) => trip.id !== excludeId && trip.salesNo.trim().toUpperCase() === salesNo.trim().toUpperCase(),
      ),
    [trips],
  )

  const deleteTrip = useCallback(
    (id) => {
      setTrips((prev) => prev.filter((trip) => trip.id !== id))
    },
    [setTrips],
  )

  // Bulk-creates trips from validated Excel rows (see excelImporter/excelMapper). Large
  // imports are committed a chunk at a time across animation frames rather than in one
  // giant setTrips call — the table still ends up rendering every row either way, but
  // spreading that work over several frames keeps the browser free to paint/respond in
  // between instead of doing it all in a single unbroken block. `createdSeq` (see
  // createTrip) makes the chunk order irrelevant: every row still sorts correctly by
  // creation time regardless of which chunk it landed in.
  const importTrips = useCallback(
    (rows, { onProgress, chunkSize = 1500 } = {}) => {
      return new Promise((resolve) => {
        const total = rows.length
        if (total === 0) {
          resolve([])
          return
        }

        const base = Date.now()
        const timestamp = nowIso()
        const allNewTrips = new Array(total)
        let index = 0

        function processChunk() {
          const end = Math.min(index + chunkSize, total)
          const chunk = []
          for (let i = index; i < end; i += 1) {
            const data = rows[i]
            const trip = {
              id: generateId('trip'),
              salesNo: data.salesNo,
              tripType: data.tripType,
              customerId: data.tripType === 'customer' ? data.customerId : null,
              sourceWarehouseId: data.sourceWarehouseId ?? null,
              destinationWarehouseId: data.tripType === 'internal' ? data.destinationWarehouseId ?? null : null,
              destination: data.destination,
              loadTons: 0,
              transporterId: data.transporterId ?? null,
              driver: data.driverName ? { name: data.driverName, phone: data.driverPhone ?? '' } : null,
              plateNo: data.plateNo ?? '',
              vehicleType: '',
              dispatchDate: data.dispatchDate,
              deliveryDate: data.deliveryDate || data.dispatchDate,
              status: data.status ?? 'planned',
              remarks: data.remarks ?? '',
              documents: [],
              timeline: [{ id: generateId('evt'), label: 'Imported from Excel', actor: 'Excel Import', timestamp }],
              whatsapp: null,
              // Descending per row so the sheet's own order is preserved (row 1 lands on
              // top), while every imported row still outranks pre-existing trips (see createTrip).
              createdSeq: base - i,
            }
            allNewTrips[i] = trip
            chunk.push(trip)
          }
          index = end

          setTrips((prev) => [...chunk, ...prev])
          onProgress?.({ processed: index, total })

          if (index < total) requestAnimationFrame(processChunk)
          else resolve(allNewTrips)
        }

        processChunk()
      })
    },
    [setTrips],
  )

  const updateTrip = useCallback(
    (id, patch) => {
      patchTrip(id, (trip) => {
        if (patch.status === 'delivered' && trip.status !== 'delivered') {
          return {
            ...patch,
            timeline: [
              ...trip.timeline,
              { id: generateId('evt'), label: 'Delivered to customer', actor: 'S. Al-Qahtani', timestamp: nowIso() },
            ],
          }
        }
        return patch
      })
    },
    [patchTrip],
  )

  const requestWhatsapp = useCallback(
    (id) => {
      const token = generateToken()
      patchTrip(id, () => ({ whatsapp: { token, requestedAt: nowIso(), filledAt: null } }))
      addTimelineEvent(id, 'Secure WhatsApp link sent to transporter', 'System')
      return token
    },
    [patchTrip, addTimelineEvent],
  )

  const getTripByToken = useCallback(
    (token) => trips.find((trip) => trip.whatsapp?.token === token),
    [trips],
  )

  const submitWhatsappUpdate = useCallback(
    (token, details) => {
      const trip = trips.find((t) => t.whatsapp?.token === token)
      if (!trip) return null
      patchTrip(trip.id, (t) => ({
        driver: { name: details.driverName, phone: details.phone },
        plateNo: details.plateNo,
        vehicleType: details.vehicleType,
        whatsapp: { ...t.whatsapp, filledAt: nowIso() },
      }))
      addTimelineEvent(trip.id, 'Driver & vehicle details submitted by transporter via WhatsApp', details.driverName)
      return trip.id
    },
    [trips, patchTrip, addTimelineEvent],
  )

  const findTripByPlate = useCallback(
    (plate) => {
      const normalized = plate.trim().toUpperCase().replace(/\s+/g, '')
      if (!normalized) return null
      return trips.find(
        (trip) =>
          ['planned', 'in_transit'].includes(trip.status) &&
          trip.plateNo.toUpperCase().replace(/\s+/g, '').includes(normalized),
      )
    },
    [trips],
  )

  const markLoaded = useCallback(
    (id) => {
      patchTrip(id, (trip) => ({ status: trip.status === 'planned' ? 'in_transit' : trip.status }))
      addTimelineEvent(id, 'Loaded and verified at warehouse', 'Warehouse scan')
    },
    [patchTrip, addTimelineEvent],
  )

  const rejectLoad = useCallback(
    (id, reason) => {
      addTimelineEvent(id, `Load rejected at warehouse — ${reason}`, 'Warehouse scan')
    },
    [addTimelineEvent],
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
      justUpdated,
      createTrip,
      importTrips,
      getSalesNumbers,
      isSalesNoTaken,
      deleteTrip,
      updateTrip,
      addTimelineEvent,
      requestWhatsapp,
      getTripByToken,
      submitWhatsappUpdate,
      findTripByPlate,
      markLoaded,
      rejectLoad,
      setCustomFieldValue,
    }),
    [
      trips,
      justUpdated,
      createTrip,
      importTrips,
      getSalesNumbers,
      isSalesNoTaken,
      deleteTrip,
      updateTrip,
      addTimelineEvent,
      requestWhatsapp,
      getTripByToken,
      submitWhatsappUpdate,
      findTripByPlate,
      markLoaded,
      rejectLoad,
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
