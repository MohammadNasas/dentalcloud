export class ApiError extends Error {
  constructor(code, status = 400) { super(code); this.status = status }
}
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const allowedOrigins = new Set(['https://dentalcloudapp.com', 'https://www.dentalcloudapp.com', 'null'])
export function response(request, body, status = 200) {
  const origin = request.headers.get('Origin')
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' }
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  return new Response(JSON.stringify(body), { status, headers })
}
export async function bodyJSON(request, limit = 12000) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError('bad_request')
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError('bad_request')
  let size = 0; const chunks = []
  while (true) {
    const { done, value } = await reader.read(); if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new ApiError('bad_request', 413) }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value
  } catch { throw new ApiError('bad_request') }
}
export function database(env, bearer) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new ApiError('setup_required', 503)
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  return async (path, method = 'GET', body) => {
    const r = await fetch(base + '/rest/v1/' + path, {
      method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: bearer || 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new ApiError('database_unavailable', 503)
    return r.status === 204 ? null : r.json()
  }
}
export async function handle(request, fn) {
  try { return response(request, await fn()) }
  catch (error) { return response(request, { ok: false, error: error instanceof ApiError ? error.message : 'service_unavailable' }, error instanceof ApiError ? error.status : 503) }
}
