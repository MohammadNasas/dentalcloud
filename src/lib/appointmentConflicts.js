const inactive = new Set(['cancelled', 'noShow'])

// Half-open intervals let one appointment start exactly when another ends.
export function appointmentConflicts(candidate, appointments) {
  const start = Date.parse(candidate.start)
  const end = Date.parse(candidate.end)
  if (inactive.has(candidate.status) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
  return appointments.filter((other) => {
    if (other.id === candidate.id || inactive.has(other.status)) return false
    const sameDoctor = candidate.doctorId && candidate.doctorId === other.doctorId
    const samePatient = candidate.patientId && candidate.patientId === other.patientId
    if (!sameDoctor && !samePatient) return false
    const otherStart = Date.parse(other.start)
    const otherEnd = Date.parse(other.end)
    return otherEnd > otherStart && start < otherEnd && end > otherStart
  }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}
