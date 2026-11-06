export function paymentApiUrl(path, protocol, desktopOrigin = 'https://dentalcloudapp.com') {
  if (protocol !== 'file:') return path
  const origin = new URL(desktopOrigin)
  if (origin.protocol !== 'https:') throw new Error('Desktop payment API must use HTTPS')
  return new URL(path, origin).href
}
