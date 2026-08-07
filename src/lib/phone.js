// Saudi mobile normalization for the transporter Mobile Number field (see
// supabase/migrations/0012_require_transporter_phone.sql, which enforces the same rule
// server-side -- this is UX-only, not the real validation boundary). Accepts either local
// (05XXXXXXXX) or international (9665XXXXXXXX) input, in any common spacing/punctuation, and
// normalizes to the digits-only international form -- the same shape wa.me links require
// (see toWhatsappDigits in lib/whatsappMessage.js), so a stored number is always ready to use
// as-is. Returns null for anything that isn't one of those two exact shapes once punctuation
// is stripped.
export function normalizeSaudiMobile(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`
  if (/^9665\d{8}$/.test(digits)) return digits
  return null
}
