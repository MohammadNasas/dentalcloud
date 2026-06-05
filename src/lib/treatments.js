// ──────────────────────────────────────────────────────────────────────────
//  Treatment & condition catalog for the dental chart.
//  We separate CONDITIONS (current state / diagnosis) from TREATMENTS (done),
//  exactly as requested: a tooth can show caries in October and a composite
//  filling in November, with the colour/shape changing accordingly.
// ──────────────────────────────────────────────────────────────────────────

// kind: 'condition' (diagnosis, current state) | 'treatment' (work performed)
// scope: 'surface' (paints specific surfaces) | 'tooth' (whole tooth) | 'mark' (overlay symbol)
export const DENTAL_ITEMS = {
  // ── Current state / diagnosis ────────────────────────────────────────────
  caries: {
    kind: 'condition', scope: 'surface', color: '#ef4444',
    en: 'Caries', ar: 'تسوّس', symbol: '',
  },
  fracture: {
    kind: 'condition', scope: 'mark', color: '#f97316',
    en: 'Fracture', ar: 'كسر', symbol: '⚡',
  },
  abscess: {
    kind: 'condition', scope: 'mark', color: '#b91c1c',
    en: 'Periapical abscess', ar: 'خرّاج ذروي', symbol: '◉',
  },
  mobility: {
    kind: 'condition', scope: 'mark', color: '#a16207',
    en: 'Mobility', ar: 'قلقلة / حركة', symbol: '↔',
  },
  impacted: {
    kind: 'condition', scope: 'tooth', color: '#9333ea',
    en: 'Impacted', ar: 'منطمر', symbol: '',
  },
  attrition: {
    kind: 'condition', scope: 'tooth', color: '#facc15',
    en: 'Attrition / Wear', ar: 'تآكل', symbol: '',
  },
  discoloration: {
    kind: 'condition', scope: 'tooth', color: '#a8a29e',
    en: 'Discoloration', ar: 'تصبّغ', symbol: '',
  },
  sensitivity: {
    kind: 'condition', scope: 'mark', color: '#06b6d4',
    en: 'Sensitivity', ar: 'حساسية', symbol: '✸',
  },
  missing: {
    kind: 'condition', scope: 'tooth', color: '#cbd5e1',
    en: 'Missing', ar: 'مفقود', symbol: '✕',
  },

  // ── Treatments performed ─────────────────────────────────────────────────
  composite: {
    kind: 'treatment', scope: 'surface', color: '#3b82f6',
    en: 'Composite filling', ar: 'حشوة كومبوزيت', symbol: '',
  },
  amalgam: {
    kind: 'treatment', scope: 'surface', color: '#475569',
    en: 'Amalgam filling', ar: 'حشوة أملغم', symbol: '',
  },
  glassionomer: {
    kind: 'treatment', scope: 'surface', color: '#14b8a6',
    en: 'Glass ionomer', ar: 'حشوة زجاجية (GI)', symbol: '',
  },
  rct: {
    kind: 'treatment', scope: 'tooth', color: '#8b5cf6',
    en: 'Root canal (RCT)', ar: 'معالجة لبية (عصب)', symbol: '▲',
  },
  crown: {
    kind: 'treatment', scope: 'tooth', color: '#f59e0b',
    en: 'Crown', ar: 'تاج', symbol: '◍',
  },
  bridge: {
    kind: 'treatment', scope: 'tooth', color: '#d97706',
    en: 'Bridge', ar: 'جسر', symbol: '═',
  },
  veneer: {
    kind: 'treatment', scope: 'tooth', color: '#ec4899',
    en: 'Veneer', ar: 'فينير / قشرة', symbol: '',
  },
  extraction: {
    kind: 'treatment', scope: 'tooth', color: '#111827',
    en: 'Extraction', ar: 'خلع', symbol: '✕',
  },
  implant: {
    kind: 'treatment', scope: 'tooth', color: '#0d9488',
    en: 'Implant', ar: 'زرعة', symbol: '⊛',
  },
  sealant: {
    kind: 'treatment', scope: 'surface', color: '#22c55e',
    en: 'Fissure sealant', ar: 'مادة مانعة للتسوّس', symbol: '',
  },
  scaling: {
    kind: 'treatment', scope: 'tooth', color: '#38bdf8',
    en: 'Scaling / Cleaning', ar: 'تقليح / تنظيف', symbol: '',
  },
  postcore: {
    kind: 'treatment', scope: 'tooth', color: '#7c3aed',
    en: 'Post & core', ar: 'وتد ولُبّ', symbol: 'P',
  },
  denture: {
    kind: 'treatment', scope: 'tooth', color: '#fb7185',
    en: 'Denture (pontic)', ar: 'طقم / سن صناعي', symbol: '',
  },
  whitening: {
    kind: 'treatment', scope: 'tooth', color: '#fde68a',
    en: 'Whitening', ar: 'تبييض', symbol: '',
  },
  ortho: {
    kind: 'treatment', scope: 'mark', color: '#6366f1',
    en: 'Orthodontic', ar: 'تقويم', symbol: '⌗',
  },
}

export const ITEM_KEYS = Object.keys(DENTAL_ITEMS)
export const CONDITION_KEYS = ITEM_KEYS.filter((k) => DENTAL_ITEMS[k].kind === 'condition')
export const TREATMENT_KEYS = ITEM_KEYS.filter((k) => DENTAL_ITEMS[k].kind === 'treatment')

// ── G.V. Black caries classification → default surfaces it paints ──────────
export const CARIES_CLASSES = {
  I: {
    en: 'Class I — pits & fissures (occlusal)',
    ar: 'الصنف الأول — الحفر والشقوق (الإطباقي)',
    surfaces: ['occlusal'],
  },
  II: {
    en: 'Class II — proximal of posterior teeth',
    ar: 'الصنف الثاني — السطح الملاصق للأسنان الخلفية',
    surfaces: ['mesial', 'occlusal', 'distal'],
  },
  III: {
    en: 'Class III — proximal of anterior teeth',
    ar: 'الصنف الثالث — السطح الملاصق للأسنان الأمامية',
    surfaces: ['mesial', 'distal'],
  },
  IV: {
    en: 'Class IV — proximal + incisal angle (anterior)',
    ar: 'الصنف الرابع — الملاصق مع الحافة القاطعة',
    surfaces: ['mesial', 'distal', 'occlusal'],
  },
  V: {
    en: 'Class V — cervical third (gingival)',
    ar: 'الصنف الخامس — الثلث العنقي (اللثوي)',
    surfaces: ['buccal'],
  },
  VI: {
    en: 'Class VI — incisal edge / cusp tips',
    ar: 'الصنف السادس — الحافة القاطعة / أطراف الحدبات',
    surfaces: ['occlusal'],
  },
}

// ── Post-operative / treatment instruction sheets (editable & printable) ───
// Sourced from standard post-operative care guidance; the dentist can edit
// freely before printing for the patient.
export const INSTRUCTIONS = {
  extraction: {
    en: {
      title: 'Post-Extraction Care Instructions',
      points: [
        'Bite firmly on the gauze pad for 30–45 minutes to control bleeding. Replace if needed.',
        'Do NOT rinse, spit, or use a straw for the first 24 hours — this protects the blood clot.',
        'Avoid smoking for at least 48–72 hours; it greatly delays healing and may cause dry socket.',
        'Apply an ice pack on the cheek (20 min on / 20 min off) for the first day to reduce swelling.',
        'Eat soft, cool foods on the first day and chew on the opposite side.',
        'After 24 hours, gently rinse with warm salt water (½ tsp salt in a cup of water) 2–3 times daily.',
        'Take prescribed pain relief / antibiotics exactly as directed. Do not skip doses.',
        'Some swelling, mild bleeding, and discomfort are normal for 1–2 days.',
        'Contact the clinic if you have heavy bleeding, severe pain after day 3, fever, or pus.',
      ],
    },
    ar: {
      title: 'تعليمات ما بعد خلع السن',
      points: [
        'اعضض على الشاش بقوة لمدة 30–45 دقيقة للسيطرة على النزيف، وبدّله عند الحاجة.',
        'لا تمضمض أو تبصق أو تستخدم الشّفّاطة خلال أول 24 ساعة للحفاظ على الخثرة الدموية.',
        'امتنع عن التدخين 48–72 ساعة على الأقل لأنه يؤخّر الشفاء وقد يسبب «السنخ الجاف».',
        'ضع كمادة ثلج على الخد (20 دقيقة تشغيل / 20 دقيقة راحة) في اليوم الأول لتقليل التورّم.',
        'تناول أطعمة طريّة وباردة في اليوم الأول وامضغ على الجهة المقابلة.',
        'بعد 24 ساعة تمضمض بلطف بماء دافئ مع ملح (نصف ملعقة في كوب ماء) 2–3 مرات يومياً.',
        'تناول المسكّنات / المضادات الحيوية الموصوفة تماماً كما وُصِفت دون إهمال أي جرعة.',
        'بعض التورّم والنزف الخفيف والانزعاج أمر طبيعي خلال يوم إلى يومين.',
        'راجع العيادة فوراً عند نزف شديد أو ألم شديد بعد اليوم الثالث أو حرارة أو قيح.',
      ],
    },
  },
  rct: {
    en: {
      title: 'After Root Canal Treatment',
      points: [
        'It is normal to feel mild tenderness for a few days; take pain relief as prescribed.',
        'Avoid chewing hard food on the treated tooth until the permanent filling/crown is placed.',
        'The temporary filling may wear slightly — that is expected. Contact us if it fully comes out.',
        'Maintain normal brushing and flossing around the tooth.',
        'A crown is usually needed to protect the tooth — please keep your follow-up appointment.',
        'Call the clinic if you have severe pain, swelling, or the bite feels high.',
      ],
    },
    ar: {
      title: 'تعليمات ما بعد معالجة العصب',
      points: [
        'من الطبيعي الشعور بألم خفيف لعدة أيام؛ تناول المسكّن الموصوف.',
        'تجنّب المضغ على السن المُعالَج حتى يتم وضع الحشوة الدائمة / التاج.',
        'قد تتآكل الحشوة المؤقتة قليلاً وهذا متوقّع؛ راجعنا إن سقطت بالكامل.',
        'استمر بتنظيف الأسنان بالفرشاة والخيط حول السن بشكل طبيعي.',
        'غالباً يحتاج السن إلى تاج لحمايته — التزم بموعد المراجعة.',
        'اتصل بالعيادة عند ألم شديد أو تورّم أو شعور بأن الإطباق مرتفع.',
      ],
    },
  },
  composite: {
    en: {
      title: 'After a Tooth-Coloured (Composite) Filling',
      points: [
        'The filling is fully set — you may eat once the numbness wears off.',
        'Mild sensitivity to hot/cold for a few days is normal and should fade.',
        'If the bite feels high or uneven, contact us for a quick adjustment.',
        'Avoid very hard foods on the filling for the first day.',
        'Keep brushing twice daily and floss to make the filling last.',
      ],
    },
    ar: {
      title: 'تعليمات ما بعد الحشوة التجميلية (كومبوزيت)',
      points: [
        'الحشوة جاهزة تماماً؛ يمكنك الأكل بعد زوال أثر التخدير.',
        'حساسية خفيفة للحار/البارد لعدة أيام أمر طبيعي وتزول تدريجياً.',
        'إن شعرت أن الإطباق مرتفع أو غير متساوٍ راجعنا لضبط بسيط.',
        'تجنّب الأطعمة القاسية جداً على الحشوة في اليوم الأول.',
        'استمر بالتنظيف مرتين يومياً واستخدم الخيط لإطالة عمر الحشوة.',
      ],
    },
  },
  crown: {
    en: {
      title: 'After Crown / Bridge Placement',
      points: [
        'Avoid sticky and very hard foods for 24 hours while the cement sets.',
        'Mild gum tenderness around the crown is normal for a few days.',
        'Clean carefully around the crown margins; floss gently (or use a floss threader for bridges).',
        'If the bite feels high or the crown feels loose, contact the clinic.',
        'With good hygiene, your crown can last many years.',
      ],
    },
    ar: {
      title: 'تعليمات ما بعد تركيب التاج / الجسر',
      points: [
        'تجنّب الأطعمة اللاصقة والقاسية جداً لمدة 24 ساعة حتى يتماسك اللاصق.',
        'انزعاج خفيف في اللثة حول التاج أمر طبيعي لبضعة أيام.',
        'نظّف بعناية حول حواف التاج واستخدم الخيط بلطف (أو خيط خاص للجسور).',
        'راجع العيادة إن شعرت أن الإطباق مرتفع أو أن التاج غير ثابت.',
        'مع العناية الجيدة يدوم التاج سنوات طويلة.',
      ],
    },
  },
  scaling: {
    en: {
      title: 'After Scaling & Cleaning',
      points: [
        'Mild gum soreness and sensitivity for 1–2 days is normal.',
        'Rinse with warm salt water 2–3 times a day if your gums feel sore.',
        'Brush gently twice a day and floss daily to keep gums healthy.',
        'Slight bleeding while brushing should settle within a few days as gums heal.',
        'Maintain regular cleaning visits every 6 months.',
      ],
    },
    ar: {
      title: 'تعليمات ما بعد التقليح والتنظيف',
      points: [
        'ألم خفيف في اللثة وحساسية ليوم أو يومين أمر طبيعي.',
        'تمضمض بماء دافئ وملح 2–3 مرات يومياً عند الشعور بألم في اللثة.',
        'نظّف بلطف مرتين يومياً واستخدم الخيط يومياً للحفاظ على صحة اللثة.',
        'نزف بسيط أثناء التنظيف يخف خلال أيام مع تحسّن اللثة.',
        'حافظ على زيارة تنظيف منتظمة كل 6 أشهر.',
      ],
    },
  },
  implant: {
    en: {
      title: 'After Dental Implant Surgery',
      points: [
        'Bite on gauze for 30–60 minutes; mild bleeding/oozing for a day is normal.',
        'Do not disturb the surgical site with your tongue or fingers.',
        'Apply ice on the cheek (20 on / 20 off) for the first 24 hours.',
        'Eat soft, cool foods; avoid the implant side while chewing.',
        'Do not smoke — it is the leading cause of implant failure.',
        'Start gentle salt-water rinses after 24 hours; take all prescribed medication.',
        'Keep your review appointments so we can monitor healing.',
      ],
    },
    ar: {
      title: 'تعليمات ما بعد زراعة السن',
      points: [
        'اعضض على الشاش 30–60 دقيقة؛ نزف خفيف ليوم أمر طبيعي.',
        'لا تعبث بمكان الجراحة باللسان أو الأصابع.',
        'ضع الثلج على الخد (20 تشغيل / 20 راحة) خلال أول 24 ساعة.',
        'تناول أطعمة طريّة وباردة وتجنّب المضغ على جهة الزرعة.',
        'امتنع عن التدخين فهو السبب الأول لفشل الزرعات.',
        'ابدأ المضمضة بالماء والملح بعد 24 ساعة وتناول كل الأدوية الموصوفة.',
        'التزم بمواعيد المراجعة لمتابعة الالتئام.',
      ],
    },
  },
  whitening: {
    en: {
      title: 'After Teeth Whitening',
      points: [
        'Avoid staining foods/drinks (coffee, tea, cola, red wine, curry) for 48 hours.',
        'Avoid smoking, which quickly re-stains the teeth.',
        'Temporary cold sensitivity is common and fades within 1–2 days.',
        'Use a sensitivity toothpaste if needed.',
        'Maintain results with good hygiene and regular cleaning.',
      ],
    },
    ar: {
      title: 'تعليمات ما بعد تبييض الأسنان',
      points: [
        'تجنّب الأطعمة والمشروبات الملوّنة (قهوة، شاي، كولا، نبيذ، كاري) لمدة 48 ساعة.',
        'تجنّب التدخين لأنه يعيد التصبّغ بسرعة.',
        'حساسية مؤقتة للبارد أمر شائع وتزول خلال يوم إلى يومين.',
        'استخدم معجون أسنان للحساسية عند الحاجة.',
        'حافظ على النتيجة بالعناية الجيدة والتنظيف المنتظم.',
      ],
    },
  },
  general: {
    en: {
      title: 'General Post-Treatment Care',
      points: [
        'Take any prescribed medication as directed.',
        'Maintain good oral hygiene: brush twice daily and floss.',
        'Avoid very hard or sticky foods on the treated area for 24 hours.',
        'Contact the clinic if you have unexpected pain, swelling, or bleeding.',
        'Keep your follow-up appointment.',
      ],
    },
    ar: {
      title: 'تعليمات عامة بعد العلاج',
      points: [
        'تناول الأدوية الموصوفة حسب الإرشادات.',
        'حافظ على نظافة الفم: فرشاة مرتين يومياً مع الخيط.',
        'تجنّب الأطعمة القاسية أو اللاصقة على منطقة العلاج لمدة 24 ساعة.',
        'راجع العيادة عند ألم أو تورّم أو نزف غير متوقّع.',
        'التزم بموعد المراجعة.',
      ],
    },
  },
}

// Map a treatment key to its instruction sheet key (fallback → general)
export function instructionKeyFor(itemKey) {
  if (INSTRUCTIONS[itemKey]) return itemKey
  if (itemKey === 'amalgam' || itemKey === 'glassionomer') return 'composite'
  if (itemKey === 'bridge') return 'crown'
  if (itemKey === 'postcore') return 'rct'
  if (itemKey === 'surgical_ext') return 'extraction'
  return 'general'
}

// Resolve a record's display name / colour whether its key is a chartable dental
// item or a billing-catalog procedure (exam, surgical extraction, …).
export function recordName(record, lang = 'en') {
  const it = DENTAL_ITEMS[record.itemKey]
  if (it) return it[lang]
  return (record.label && (record.label[lang] || record.label.en || record.label)) || record.itemKey
}
export function recordColor(record) {
  return DENTAL_ITEMS[record.itemKey]?.color || '#64748b'
}

// Default treatment price list (the dentist edits these in Settings; price can
// also be overridden at entry time to apply a discount).
export const DEFAULT_PRICES = [
  { key: 'exam', en: 'Examination & consultation', ar: 'فحص واستشارة', price: 20 },
  { key: 'composite', en: 'Composite filling', ar: 'حشوة كومبوزيت', price: 40 },
  { key: 'amalgam', en: 'Amalgam filling', ar: 'حشوة أملغم', price: 35 },
  { key: 'rct', en: 'Root canal treatment', ar: 'معالجة لبية (عصب)', price: 150 },
  { key: 'crown', en: 'Crown (PFM / Zirconia)', ar: 'تاج', price: 200 },
  { key: 'extraction', en: 'Simple extraction', ar: 'خلع بسيط', price: 30 },
  { key: 'surgical_ext', en: 'Surgical extraction', ar: 'خلع جراحي', price: 80 },
  { key: 'scaling', en: 'Scaling & polishing', ar: 'تقليح وتلميع', price: 40 },
  { key: 'implant', en: 'Dental implant', ar: 'زرعة سنية', price: 600 },
  { key: 'veneer', en: 'Veneer', ar: 'فينير', price: 220 },
  { key: 'whitening', en: 'Whitening (in-office)', ar: 'تبييض', price: 180 },
  { key: 'sealant', en: 'Fissure sealant', ar: 'مادة مانعة للتسوّس', price: 25 },
]
