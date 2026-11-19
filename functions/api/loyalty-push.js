import { ApiError,bodyJSON,database,handle } from '../_lib/loyaltyAccess.js'
import { requirePatientOrigin,validatePushSubscription } from '../_lib/loyaltyPush.js'
export const onRequestGet=({request,env})=>handle(request,async()=>({ok:true,config:await database(env)('rpc/loyalty_push_config','POST',{})}))
export const onRequestPost=({request,env})=>handle(request,async()=>{
  requirePatientOrigin(request)
  const {token,action,subscription,lang}=await bodyJSON(request)
  if (!/^[a-f0-9]{64}$/.test(token || '') || !['status','subscribe','remove'].includes(action)) throw new ApiError('bad_request')
  const value=action==='subscribe'?validatePushSubscription(subscription):{endpoint:String(subscription?.endpoint || '').slice(0,2048)}
  return {ok:true,...await database(env)('rpc/loyalty_push_manage','POST',{
    p_token:token,p_action:action,p_subscription:value,p_lang:lang==='en'?'en':'ar',
  })}
})
