import { ApiError } from './loyaltyAccess.js'
export function validatePushEndpoint(value) {
  try {
    const u=new URL(value)
    const h=u.hostname
    if (u.protocol!=='https:' || u.port || u.username || u.password || u.hash || value.length>2047) return false
    return h==='fcm.googleapis.com' || h==='web.push.apple.com' || h.endsWith('.push.apple.com') ||
      h==='updates.push.services.mozilla.com' || h.endsWith('.push.services.mozilla.com') || h.endsWith('.notify.windows.com')
  } catch { return false }
}
export function validatePushSubscription(value) {
  if (!value || !validatePushEndpoint(value.endpoint) || !/^[A-Za-z0-9_-]{87}={0,1}$/.test(value.keys?.p256dh || '') ||
      !/^[A-Za-z0-9_-]{22}={0,2}$/.test(value.keys?.auth || '')) throw new ApiError('bad_subscription')
  return { endpoint:value.endpoint, keys:{p256dh:value.keys.p256dh,auth:value.keys.auth} }
}
export function requirePatientOrigin(request) {
  if (!['https://dentalcloudapp.com','https://www.dentalcloudapp.com'].includes(request.headers.get('Origin'))) throw new ApiError('forbidden',403)
}
export function pushMessage(job) {
  const ar=job.lang!=='en'
  return { title:'DentalCloud',body:job.kind==='appointment'
    ? (ar?'تذكير بموعدك القادم في العيادة.':'A reminder of your upcoming clinic appointment.')
    : (ar?'اهتم بابتسامتك. تواصل مع عيادتك لحجز مراجعة مناسبة لك.':'Care for your smile. Contact your clinic to arrange a check-up.'),
    appointmentStart:job.kind==='appointment'?job.start:null,lang:ar?'ar':'en',url:job.url,tag:'dc-'+job.id }
}
