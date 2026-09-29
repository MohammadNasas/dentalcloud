import { Component, Suspense } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { Spinner } from './ui'

class PageLoadError extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div role="alert" className="space-y-3 p-6 text-center">
      <p>{this.props.ar ? 'تعذّر فتح الصفحة. تحقق من الاتصال وأعد تحميلها.' : 'Could not open this page. Check your connection and reload.'}</p>
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
