import { buildPushPayload } from '@block65/webcrypto-web-push'
import { ApiError,bodyJSON,database,handle } from '../_lib/loyaltyAccess.js'
import { pushMessage,validatePushSubscription } from '../_lib/loyaltyPush.js'
export const onRequestPost=({request,env})=>handle(request,async()=>{
  const secret=request.headers.get('Authorization')?.replace(/^Bearer /,'')
  if (!/^[a-f0-9]{64}$/.test(secret || '')) throw new ApiError('forbidden',403)
  await bodyJSON(request)
  const db=database(env)
  const {jobs=[],vapid}=await db('rpc/loyalty_push_claim','POST',{p_secret:secret})
  let accepted=0
  for (const job of jobs) {
    let status=0
    try {
      const sub=validatePushSubscription(job)
      const payload=await buildPushPayload({data:JSON.stringify(pushMessage(job)),options:{ttl:3600}},sub,vapid)
      const sent=await fetch(sub.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(10000)})
      status=sent.status
      if (sent.ok) accepted++
      await sent.body?.cancel()
    } catch { /* No sensitive payloads/endpoints in logs; ambiguous failures are not retried. */ }
    await db('rpc/loyalty_push_finish','POST',{p_secret:secret,p_id:job.id,p_claim:job.claim,p_status:status})
  }
  return {ok:true,processed:jobs.length,accepted}
})
