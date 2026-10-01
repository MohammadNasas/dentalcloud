import { parseISO } from 'date-fns'
import { createPatientMatcher } from './patientSearch.js'

export function filterPatients({ patients, appointments, balanceForPatient, query = '', filter = 'all', allowBalances = false, allowAppointments = false, now = new Date() }) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  // Thirty local calendar days, including today; not thirty fixed 24-hour periods.
  const recentStart = new Date(today)
  recentStart.setDate(recentStart.getDate() - 29)
  const todayIds = new Set(allowAppointments ? appointments.filter((appointment) => {
    const start = parseISO(appointment.start || '')
    return appointment.status !== 'cancelled' && start >= today && start < tomorrow
  }).map((appointment) => appointment.patientId) : [])
  const allowed = ['all', 'new', ...(allowBalances ? ['debt'] : []), ...(allowAppointments ? ['today'] : [])]
  const activeFilter = allowed.includes(filter) ? filter : 'all'
  const counts = { all: 0, debt: 0, today: 0, new: 0 }
  const list = []
  const matchesSearch = createPatientMatcher(query)
  for (const patient of patients) {
    if (!matchesSearch(patient)) continue
    const created = parseISO(patient.createdAt || '')
    const matches = {
      all: true,
      debt: allowBalances && balanceForPatient(patient.id)?.debt > 0,
      today: todayIds.has(patient.id),
      new: created >= recentStart && created <= now,
    }
    for (const key of Object.keys(counts)) if (matches[key]) counts[key] += 1
    if (matches[activeFilter]) list.push(patient)
  }
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return { list, counts, activeFilter }
}
