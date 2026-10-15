import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { pageMetadata } from '../lib/seo'
import { isElectron } from '../lib/downloads'

export default function PageMetadata() {
  const location = useLocation(), { currentUser } = useStore(), { lang } = useI18n()
  useEffect(() => {
    if (isElectron || window.location.protocol === 'file:') return
    const meta = pageMetadata({ path:location.pathname, search:location.search, hash:location.hash, signedIn:Boolean(currentUser), lang })
    document.title = meta.title
    const set = (attribute, key, value) => {
      let node = document.head.querySelector(`meta[${attribute}="${key}"]`)
      if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.appendChild(node) }
      node.content = value
    }
    set('name','description',meta.description); set('name','robots',meta.robots)
    set('property','og:title',meta.title); set('property','og:description',meta.description)
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (meta.canonical) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel='canonical'; document.head.appendChild(canonical) }
      canonical.href = meta.canonical
      set('property','og:url',meta.canonical)
    } else { canonical?.remove(); document.head.querySelector('meta[property="og:url"]')?.remove() }
  }, [location.pathname, location.search, location.hash, currentUser?.id, lang])
  return null
}
