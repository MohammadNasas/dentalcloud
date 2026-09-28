export function paymentApiUrl(path, protocol, desktopOrigin = 'https://dentalcloud.pages.dev') {
  if (protocol !== 'file:') return path
  const origin = new URL(desktopOrigin)
  if (origin.protocol !== 'https:') throw new Error('Desktop payment API must use HTTPS')
  return new URL(path, origin).href
}
