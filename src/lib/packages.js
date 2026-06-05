// Feature lists shown on the Packages page (before purchase) to entice upgrades.
export const PACKAGE_FEATURES = {
  student: {
    accent: '#0ea5e9',
    features: [
      { en: 'Digital patient records & files', ar: 'سجلات وملفات مرضى رقمية' },
      { en: 'Full medical & dental history + clinical exam', ar: 'تاريخ طبي وسنّي كامل + فحص سريري' },
      { en: 'Interactive chart — permanent (1–8) & primary (A–E)', ar: 'مخطط تفاعلي — الدائمة (1–8) واللبنية (A–E)' },
      { en: 'Conditions & treatments with colours, surfaces & G.V. Black classes', ar: 'حالات وعلاجات بالألوان والأسطح وأصناف G.V. Black' },
      { en: 'Gingival overview & per-tooth history', ar: 'نظرة على اللثة وسجل لكل سن' },
      { en: 'Fees / paid / remaining tracking', ar: 'تتبّع الأجور / المدفوع / المتبقي' },
      { en: 'Export to Word (per patient & all patients)', ar: 'تصدير إلى Word (لكل مريض وللكل)' },
      { en: 'Treatment timeline', ar: 'الخط الزمني للعلاج' },
      { en: 'Current-state vs treatment view per tooth', ar: 'تبديل بين الحالة والعلاج لكل سن' },
      { en: 'Printable instruction sheets', ar: 'أوراق تعليمات للطباعة' },
    ],
  },
  economy: {
    accent: '#0d9488',
    inherits: 'student',
    features: [
      { en: 'Unified appointments calendar', ar: 'تقويم مواعيد موحّد' },
      { en: 'Multiple doctors — each with a calendar colour', ar: 'عدة أطباء — لكل طبيب لون في التقويم' },
      { en: 'Periodontal chart + O’Leary plaque index', ar: 'مخطط لثة + مؤشر اللويحة (O’Leary)' },
      { en: 'Smart “top 3 teeth to treat” after exam', ar: 'اقتراح ذكي «أهم 3 أسنان» بعد الفحص' },
      { en: 'Tomorrow’s reminders — call to confirm', ar: 'تذكير مواعيد الغد — للتأكيد هاتفياً' },
      { en: 'Treatment price list + on-the-fly discounts', ar: 'قائمة أسعار العلاجات + خصومات فورية' },
      { en: 'Per-visit work log & step reached', ar: 'سجل عمل لكل زيارة والخطوة المنجزة' },
      { en: 'Payment methods (cash / card / insurance / cheque)', ar: 'طرق دفع (نقد / بطاقة / تأمين / شيك)' },
    ],
  },
  pro: {
    accent: '#7c3aed',
    inherits: 'economy',
    features: [
      { en: 'Before/after photos & X-ray gallery', ar: 'معرض صور قبل/بعد وأشعة' },
      { en: 'Monthly performance reports & charts', ar: 'تقارير ورسوم أداء شهرية' },
      { en: 'Split payments (cash + card together)', ar: 'دفع مقسّم (نقد + بطاقة معاً)' },
      { en: 'Collection rate & revenue analytics', ar: 'تحليلات نسبة التحصيل والإيراد' },
      { en: 'Priority support', ar: 'دعم بأولوية' },
    ],
  },
}

// Resolve the full (inherited) feature set for a tier.
export function fullFeatures(tierId) {
  const chain = []
  let cur = tierId
  while (cur) { chain.unshift(cur); cur = PACKAGE_FEATURES[cur].inherits }
  return chain.flatMap((id) => PACKAGE_FEATURES[id].features)
}
