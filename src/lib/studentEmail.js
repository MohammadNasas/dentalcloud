// Eligibility is deliberately domain-based, not proof of current enrolment.
// The database independently checks the confirmed auth identity.
export function isStudentEmail(value) {
  if (typeof value !== 'string') return false
  const email = value.trim().toLowerCase()
  const parts = email.split('@')
  if (parts.length !== 2 || !parts[0] || /\s/.test(email)) return false
  const domain = parts[1]
  if (domain.length > 253) return false
  const labels = domain.split('.')
  return labels.length > 1 && labels.slice(1).includes('edu') &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
}
