// Use the same verified billing logic on both deployment platforms.
import { onRequestPost, onRequestOptions } from '../../functions/api/paypal-capture.js'

export default async function handler(request) {
  if (request.method === 'OPTIONS') return onRequestOptions()
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  return onRequestPost({ request, env: process.env })
}
