import { ApiError, database, bodyJSON, handle, response } from '../_lib/loyaltyAccess.js'
export const onRequestOptions = ({ request }) => response(request, {})
export const onRequestPost = ({ request, env }) => handle(request, async () => {
  const { token } = await bodyJSON(request)
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError('card_not_found', 404)
  const card = await database(env)('rpc/read_public_loyalty_card', 'POST', { p_token: token })
  if (!card) throw new ApiError('card_not_found', 404)
  return { ok: true, card }
})
