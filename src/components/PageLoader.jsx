import { Component, Suspense } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { Spinner } from './ui'
import { isPageAssetError } from '../lib/pageLoadError.js'

class PageLoadError extends Component {
  state = { failed: false, assetError: false }
  static getDerivedStateFromError(error) { return { failed: true, assetError: isPageAssetError(error) } }
  render() {
    if (this.state.failed) return <div role="alert" className="space-y-3 p-6 text-center">
      <p>{this.state.assetError
        ? (this.props.ar ? 'تعذّر تحميل جزء من الصفحة. أعد تحميلها للحصول على أحدث نسخة.' : 'Part of this page could not load. Reload to get the latest version.')
        : (this.props.ar ? 'تعذّر عرض الصفحة. أعد المحاولة، وإذا تكررت المشكلة تواصل معنا.' : 'This page could not be displayed. Retry, or contact us if the problem continues.')}</p>
      <button className="btn-primary" onClick={() => window.location.reload()}>{this.props.ar ? 'إعادة تحميل' : 'Reload'}</button>
    </div>
    return this.props.children
  }
}

export default function PageLoader({ children }) {
  const { lang } = useI18n()
  return <PageLoadError ar={lang === 'ar'}>
    <Suspense fallback={<div role="status" className="flex items-center justify-center gap-3 p-12"><Spinner />{lang === 'ar' ? 'جاري فتح الصفحة…' : 'Opening page…'}</div>}>
      {children}
    </Suspense>
  </PageLoadError>
}
