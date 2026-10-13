const TABLES = {
  expenses: 'clinic_expenses',
  patients: 'patients', toothRecords: 'tooth_records', appointments: 'appointments',
  payments: 'payments', suggestions: 'suggestions', doctors: 'doctors', lab_orders: 'lab_orders',
}

function confirmed(result) {
  if (result.error) throw result.error
  if (!result.data) throw new Error('The server did not confirm this write')
  return result.data
}

export function createCloudWrites(client) {
  return {
    async importPatients(patients) {
      if (!Array.isArray(patients) || !patients.length || patients.length > 500
        || patients.some(p => !p.id || p.clinicId !== patients[0].clinicId || !p.importSource?.fingerprint)
        || new Set(patients.map(p => p.id)).size !== patients.length) throw new Error('invalidBatch')
      // A single INSERT statement is atomic. Ignore conflicts: a retry must never
      // overwrite edits made after an earlier, successfully committed import.
      const result = await client.from('patients').upsert(patients.map(p => ({ id: p.id, clinic_id: p.clinicId, data: p })),
        { onConflict: 'id', ignoreDuplicates: true }).select('id,clinic_id,data')
      if (result.error) throw result.error
      if (!Array.isArray(result.data)) throw new Error('Import was not confirmed')
      return { inserted: result.data.map(r => ({ ...r.data, id: r.id, clinicId: r.clinic_id })), skipped: patients.length - result.data.length }
    },
    async save(table, obj) {
      const row = confirmed(await client.from(TABLES[table])
        .upsert({ id: obj.id, clinic_id: obj.clinicId, data: obj })
        .select('id,clinic_id,data').single())
      return { ...row.data, id: row.id, clinicId: row.clinic_id }
    },
    async remove(table, id) {
      if (table === 'patients') {
        // One transaction: a failed child delete must leave the patient intact.
        const result = await client.rpc('delete_patient_with_records', { p_patient_id: id })
        confirmed(result)
      } else {
        confirmed(await client.from(TABLES[table]).delete().eq('id', id).select('id').single())
      }
      return true
    },
    async saveClinic(clinic) {
      const row = confirmed(await client.from('clinics').update({ data: clinic })
        .eq('id', clinic.id).select('id,data').single())
      // Includes canonical, server-protected subscription fields.
      return { ...row.data, id: row.id }
    },
  }
}
