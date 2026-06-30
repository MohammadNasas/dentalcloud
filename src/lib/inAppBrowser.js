// Detects social-app in-app browsers (Instagram / Facebook / TikTok / …), which
// break Supabase sign-in and — most importantly — block PayPal checkout from
// opening. Mirrors the up-front guard in index.html.
export function isInAppBrowser() {
  try {
    return /(Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|TikTok|musical_ly|BytedanceWebview|Snapchat|Line\/|Twitter|Pinterest)/i.test(navigator.userAgent || '')
  } catch { return false }
}

// Shows the full-screen "open in your browser" notice defined in index.html.
// Pass true when a payment was blocked so the wording mentions PayPal.
export function openInBrowserNotice(payment = false) {
  if (typeof window !== 'undefined' && typeof window.__openInBrowserNotice === 'function') {
    window.__openInBrowserNotice(payment)
    return true
  }
  return false
}
