const staffTables = [['doctors', 'doctors'], ['patients', 'patients'], ['tooth_records', 'toothRecords'],
  ['appointments', 'appointments'], ['payments', 'payments'], ['lab_orders', 'labOrders']]
const empty = clinic => ({ clinic, doctors: [], patients: [], toothRecords: [], appointments: [], payments: [], suggestions: [], labOrders: [], expenses: [] })

// Independent collections load together; pages within each collection stay ordered.
// Nothing is returned until every collection succeeds. Never publish partial data.
export async function loadStaffClinic(rpc, clinic) {
  const out = empty(clinic)
  await Promise.all(staffTables.map(async ([table, key]) => {
    let after = null
    do {
      const page = await rpc('clinic_profile_rows', { p_table: table, p_after: after })
      out[key].push(...page.rows.filter(row => !row._restricted))
      after = page.next
    } while (after)
  }))
  return out
}

export async function loadOwnerClinic(client, clinic) {
  const out = empty(clinic)
  await Promise.all([...staffTables, ['suggestions', 'suggestions'], ['clinic_expenses', 'expenses']].map(async ([table, key]) => {
    for (let offset = 0; ; offset += 500) {
      let query = client.from(table).select('*')
      // Existing RLS permits the app owner's global suggestions inbox.
      if (table !== 'suggestions') query = query.eq('clinic_id', clinic.id)
      const { data, error } = await query.order('id').range(offset, offset + 499)
      if (error) throw error
      out[key].push(...(data || []).map(row => ({ ...row.data, id: row.id, clinicId: row.clinic_id })))
      if ((data || []).length < 500) break
    }
  }))
  return out
}
