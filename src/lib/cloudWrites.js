const TABLES = {
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
