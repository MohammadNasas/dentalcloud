// A billing update must not overwrite clinic settings saved concurrently.
// The RPC merges only changed fields and rejects a newer billing revision.
export async function saveSubscription(supaUrl, headers, clinicId, previous, next) {
  const patch = Object.fromEntries(Object.entries(next).filter(([key, value]) =>
    key !== 'subscriptionRevision' && JSON.stringify(value) !== JSON.stringify(previous[key])))
  const response = await fetch(`${supaUrl}/rest/v1/rpc/apply_subscription_patch`, {
    method: 'POST', headers,
    body: JSON.stringify({ p_clinic_id: clinicId, p_expected_revision: previous.subscriptionRevision || null, p_patch: patch }),
  })
  if (!response.ok) throw new Error('subscription_update_failed')
  const saved = await response.json()
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('subscription_changed_retry')
  return saved
}
