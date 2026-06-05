import { Lock, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore, FEATURE_MIN_TIER } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { TIERS } from '../lib/db'

// Wraps content that belongs to a higher plan. If the current clinic's tier is
// sufficient, renders children; otherwise shows an upgrade prompt.
export default function FeatureLock({ feature, children, soft }) {
  const { can } = useStore()
  const { t, L } = useI18n()
  const navigate = useNavigate()

  if (can(feature)) return children

  const need = FEATURE_MIN_TIER[feature]
  const tierInfo = TIERS[need]

  if (soft) {
    return (
      <button
        onClick={() => navigate('/packages')}
        className="chip bg-amber-50 text-amber-600 hover:bg-amber-100"
        title={t('tier.lockedFeature')}
      >
        <Lock size={12} /> {t('tier.upgradeTo')} {L(tierInfo)}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-500">
        <Lock size={28} />
      </div>
      <div className="max-w-sm">
        <h3 className="text-lg font-bold text-ink-800">{t('tier.lockedFeature')}</h3>
        <p className="mt-1 text-sm text-ink-500">
          {t('tier.unlockWith')} <span className="font-bold text-amber-600">{L(tierInfo)}</span>
        </p>
      </div>
      <button onClick={() => navigate('/packages')} className="btn-primary">
        <Sparkles size={16} /> {t('common.upgrade')}
      </button>
    </div>
  )
}
