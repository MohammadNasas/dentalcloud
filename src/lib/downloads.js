// Desktop app download links — point at the latest GitHub Release assets,
// which are built & published automatically by .github/workflows/release.yml.
export const GITHUB_REPO = 'MohammadNasas/dentacare'
const BASE = `https://github.com/${GITHUB_REPO}/releases/latest/download`

export const DOWNLOADS = [
  { id: 'win64', os: 'windows', en: 'Windows (64-bit)', ar: 'ويندوز (64-بت)', note: { en: 'Most PCs', ar: 'أغلب الأجهزة' }, file: 'DentalCloud-Windows-x64-Setup.exe' },
  { id: 'win32', os: 'windows', en: 'Windows (32-bit)', ar: 'ويندوز (32-بت)', note: { en: 'Older PCs', ar: 'أجهزة قديمة' }, file: 'DentalCloud-Windows-ia32-Setup.exe' },
  { id: 'mac-arm', os: 'mac', en: 'macOS (Apple Silicon)', ar: 'ماك (Apple Silicon)', note: { en: 'M1/M2/M3', ar: 'M1/M2/M3' }, file: 'DentalCloud-macOS-arm64.dmg' },
  { id: 'mac-intel', os: 'mac', en: 'macOS (Intel)', ar: 'ماك (Intel)', note: { en: 'Intel Macs', ar: 'أجهزة Intel' }, file: 'DentalCloud-macOS-x64.dmg' },
]

export function downloadUrl(file) {
  return `${BASE}/${file}`
}

export const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`

// Best guess of the visitor's OS to highlight the recommended download.
export function detectOS() {
  const ua = (navigator.userAgent || '').toLowerCase()
  const plat = (navigator.platform || '').toLowerCase()
  if (/mac/.test(ua) || /mac/.test(plat)) return 'mac'
  if (/win/.test(ua) || /win/.test(plat)) return 'windows'
  return 'windows'
}

export const isElectron = /electron/i.test(navigator.userAgent || '')
