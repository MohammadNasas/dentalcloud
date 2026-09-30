import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

// Search normalization only: never rewrite the patient's saved phone number.
function normalize(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim().toLowerCase()
}

function phoneParts(value) {
  const text = normalize(value)
  if (!/^[+\d\s().-]+$/.test(text)) return null
  const digits = text.replace(/\D/g, '')
  if (!digits) return null
  const explicit = text.startsWith('+') || digits.startsWith('00')
  const full = digits.startsWith('00') ? digits.slice(2) : digits
  // Unmarked long numbers may contain a country code (e.g. 970599123456).
  // Short fragments stay local so typing part of a phone continues to work.
  const parsed = (explicit || (full.length > 10 && !full.startsWith('0')))
    ? parsePhoneNumberFromString('+' + full, { extract: false }) : null
  const international = explicit || Boolean(parsed?.isPossible())
  return {
    full,
    international,
    country: international ? parsed?.countryCallingCode : null,
    national: (international && parsed ? parsed.nationalNumber : full).replace(/^0+/, '') || full,
  }
}

function phoneMatches(stored, query) {
  if (!stored || !query) return false
  if (stored.international && query.international) {
    if (stored.country && query.country) {
      return stored.country === query.country && stored.national.includes(query.national)
    }
    return stored.full.includes(query.full)
  }
  if (query.international) {
    // A full international query can find a saved local number. Do not match a
    // different patient's number just because a short country prefix overlaps.
    return Boolean(query.country) && query.national.length >= 7
      && stored.national === query.national
  }
  return stored.full.includes(query.full) || stored.national.includes(query.national)
}

export function createPatientMatcher(query) {
  const term = normalize(query)
  if (!term) return () => true
  const phoneQuery = phoneParts(term)
  const fileQuery = term.replace(/^#\s*/, '')
  return (patient) => Boolean(
    normalize(patient.name).includes(term)
    || normalize(patient.nameAr).includes(term)
    || (fileQuery && normalize(patient.fileNo).includes(fileQuery))
    || phoneMatches(phoneParts(patient.phone), phoneQuery)
  )
}

