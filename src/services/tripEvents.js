import { supabase } from '../lib/supabase'

// Reads the durable audit trail for one trip (populated by the Phase 3 warehouse-loading
// RPCs -- see supabase/migrations/0007_trip_loading_rpc.sql). Uses the existing
// trip_events_select RLS policy; no client write access exists or is added here.
export async function fetchTripEvents(tripId) {
  const { data, error } = await supabase
    .from('trip_events')
    .select('id, event_type, actor_name, reason, metadata, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}
