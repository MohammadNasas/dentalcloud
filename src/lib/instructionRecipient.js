import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

// Never guess a country: the same local number can belong to different people.
export function instructionRecipientPhone(value) {
  const text = String(value ?? '').normalize('NFKC')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim()
  if (!text) return { status: 'missing', number: '' }
  if (!/^[+\d\s().-]+$/.test(text)) return { status: 'invalid', number: '' }
  const digits = text.replace(/\D/g, '').replace(/^00/, '')
  const parsed = parsePhoneNumberFromString('+' + digits, { extract: false })
  if (digits.startsWith('0') || !parsed?.isPossible()) return { status: 'invalid', number: '' }
  return { status: 'ready', number: parsed.number.slice(1) }
}
