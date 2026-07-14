const option = (key, en, ar) => ({ key, en, ar })

const YES_NO = [
  option('yes', 'Yes', 'نعم'),
  option('no', 'No', 'لا'),
]

const NONE_LEFT_RIGHT = [
  option('none', 'None', 'لا يوجد'),
  option('left', 'Left', 'يسار'),
  option('right', 'Right', 'يمين'),
  option('both', 'Both sides', 'الجانبان'),
]

const CLASS_I_II_III = [
  option('classI', 'Class I', 'صنف I'),
  option('classII', 'Class II', 'صنف II'),
  option('classIII', 'Class III', 'صنف III'),
]

const MOLAR_RELATION = [
  option('classI', 'Class I', 'صنف I'),
  option('classIIHalf', 'Class II - half unit', 'صنف II - نصف وحدة'),
  option('classIIFull', 'Class II - full unit', 'صنف II - وحدة كاملة'),
  option('classIII', 'Class III', 'صنف III'),
]

export const ORTHO_SECTIONS = [
  {
    id: 'consultation',
    en: 'Consultation & growth',
    ar: 'المقابلة والنمو',
    groups: [
      {
        id: 'interview',
        en: 'Patient interview',
        ar: 'مقابلة المريض',
        fields: [
          {
            id: 'chiefComplaint', type: 'textarea', span: 'full',
            en: "Chief complaint in the patient's own words", ar: 'الشكوى الرئيسية بكلمات المريض',
            placeholder: { en: 'Record the main reason for seeking treatment', ar: 'سجّل السبب الرئيسي لطلب العلاج' },
          },
          {
            id: 'concernsPriority', type: 'textarea', span: 'full',
            en: 'Concerns in order of importance', ar: 'المشاكل حسب الأولوية',
            placeholder: { en: '1.\n2.\n3.', ar: '١.\n٢.\n٣.' },
          },
          {
            id: 'medicalDentalHistory', type: 'textarea', span: 'full',
            en: 'Relevant medical and dental history', ar: 'التاريخ الطبي والسنّي المتعلق بالعلاج',
          },
          {
            id: 'currentMedications', type: 'textarea',
            en: 'Current medications', ar: 'الأدوية الحالية',
          },
          {
            id: 'latexAllergy', type: 'single', options: YES_NO,
            en: 'Latex allergy', ar: 'حساسية اللاتكس',
          },
        ],
      },
      {
        id: 'growth',
        en: 'Growth potential',
        ar: 'قابلية النمو',
        fields: [
          { id: 'height', type: 'number', unit: 'cm', en: 'Height', ar: 'الطول' },
          { id: 'weight', type: 'number', unit: 'kg', en: 'Weight', ar: 'الوزن' },
          {
            id: 'recentGrowthSigns', type: 'multi', span: 'full',
            en: 'Recent growth signs', ar: 'علامات النمو الحديثة',
            options: [
              option('clothes', 'Change in clothes size', 'تغيّر مقاس الملابس'),
              option('shoes', 'Change in shoe size', 'تغيّر مقاس الحذاء'),
              option('secondary', 'Secondary sexual characteristics', 'ظهور الصفات الجنسية الثانوية'),
              option('menarche', 'Menarche achieved', 'بدء الدورة الشهرية'),
            ],
          },
          {
            id: 'growthStage', type: 'single', span: 'full',
            en: 'Estimated growth stage', ar: 'مرحلة النمو المتوقعة',
            options: [
              option('prepubertal', 'Before growth spurt', 'قبل طفرة النمو'),
              option('peak', 'At peak growth spurt', 'في ذروة طفرة النمو'),
              option('postpubertal', 'After growth spurt', 'بعد طفرة النمو'),
              option('complete', 'Growth completed', 'اكتمل النمو'),
            ],
          },
          {
            id: 'growthNotes', type: 'textarea', span: 'full',
            en: 'Growth and family maturation notes', ar: 'ملاحظات النمو والنضج العائلي',
          },
        ],
      },
    ],
  },
  {
    id: 'extraoral',
    en: 'Extraoral examination',
    ar: 'الفحص خارج الفم',
    groups: [
      {
        id: 'frontal',
        en: 'Frontal facial assessment',
        ar: 'تقييم الوجه الأمامي',
        fields: [
          { id: 'facialSymmetry', type: 'single', options: YES_NO, en: 'Facial symmetry', ar: 'تناظر الوجه' },
          {
            id: 'lowerFacialHeight', type: 'single',
            en: 'Lower facial height', ar: 'ارتفاع الثلث السفلي للوجه',
            options: [option('average', 'Average', 'متوسط'), option('increased', 'Increased', 'زائد'), option('decreased', 'Decreased', 'ناقص')],
          },
          {
            id: 'facialAsymmetryNotes', type: 'text', span: 'full',
            en: 'Asymmetry notes', ar: 'ملاحظات عدم التناظر',
          },
          {
            id: 'lipCompetency', type: 'single',
            en: 'Lip competency at rest', ar: 'انطباق الشفتين في وضع الراحة',
            options: [option('competent', 'Competent', 'منطبقتان'), option('incompetent', 'Incompetent', 'غير منطبقتين')],
          },
          { id: 'interlabialGap', type: 'number', unit: 'mm', en: 'Interlabial gap', ar: 'المسافة بين الشفتين' },
        ],
      },
      {
        id: 'smile',
        en: 'Smile assessment',
        ar: 'تقييم الابتسامة',
        fields: [
          {
            id: 'smileLine', type: 'single',
            en: 'Smile line', ar: 'خط الابتسامة',
            options: [option('average', 'Average', 'متوسط'), option('high', 'High', 'مرتفع'), option('low', 'Low', 'منخفض')],
          },
          { id: 'gingivalDisplay', type: 'number', unit: 'mm', en: 'Gingival display', ar: 'ظهور اللثة عند الابتسام' },
          {
            id: 'smileArc', type: 'single', span: 'full',
            en: 'Smile arc', ar: 'قوس الابتسامة',
            options: [
              option('consonant', 'Consonant', 'متناسق'),
              option('flat', 'Flat', 'مسطّح'),
              option('reverse', 'Reverse', 'معكوس'),
            ],
          },
          { id: 'facialMidlineDeviation', type: 'number', unit: 'mm', en: 'Facial midline deviation', ar: 'انحراف خط منتصف الوجه' },
          { id: 'facialMidlineDirection', type: 'single', options: NONE_LEFT_RIGHT.slice(0, 3), en: 'Deviation direction', ar: 'جهة الانحراف' },
        ],
      },
      {
        id: 'profile',
        en: 'Profile assessment',
        ar: 'تقييم الجانب',
        fields: [
          {
            id: 'profileType', type: 'single', span: 'full',
            en: 'Profile type', ar: 'شكل الجانب',
            options: [option('straight', 'Straight', 'مستقيم'), option('convex', 'Convex', 'محدّب'), option('concave', 'Concave', 'مقعّر')],
          },
          {
            id: 'facialDivergence', type: 'single', span: 'full',
            en: 'Facial divergence', ar: 'اتجاه بروز الوجه',
            options: [option('anterior', 'Anterior', 'أمامي'), option('straight', 'Straight', 'مستقيم'), option('posterior', 'Posterior', 'خلفي')],
          },
          {
            id: 'verticalFacialPattern', type: 'single', span: 'full',
            en: 'Vertical facial pattern', ar: 'النمط العمودي للوجه',
            options: [option('average', 'Average', 'متوسط'), option('dolicho', 'Long / dolichofacial', 'طويل'), option('brachy', 'Short / brachyfacial', 'قصير')],
          },
          {
            id: 'mandibularPlane', type: 'single',
            en: 'Mandibular plane angle', ar: 'زاوية مستوى الفك السفلي',
            options: [option('flat', 'Flat', 'مسطّحة'), option('average', 'Average', 'متوسطة'), option('steep', 'Steep', 'شديدة الميل')],
          },
          { id: 'nasolabialAngle', type: 'number', unit: '°', en: 'Nasolabial angle', ar: 'الزاوية الأنفية الشفوية' },
          { id: 'extraoralNotes', type: 'textarea', span: 'full', en: 'Extraoral notes', ar: 'ملاحظات الفحص خارج الفم' },
        ],
      },
    ],
  },
  {
    id: 'intraoral',
    en: 'Intraoral examination',
    ar: 'الفحص داخل الفم',
    groups: [
      {
        id: 'oralHealth',
        en: 'Oral health',
        ar: 'صحة الفم',
        fields: [
          {
            id: 'oralHygiene', type: 'single', span: 'full',
            en: 'Oral hygiene level', ar: 'مستوى نظافة الفم',
            options: [option('good', 'Good', 'جيد'), option('fair', 'Fair', 'متوسط'), option('poor', 'Poor', 'ضعيف')],
          },
          {
            id: 'dentistClearance', type: 'single', span: 'full',
            en: 'General dentist clearance', ar: 'موافقة طبيب الأسنان العام',
            options: [option('complete', 'Complete', 'مكتملة'), option('pending', 'Pending', 'قيد الانتظار'), option('notRequired', 'Not required', 'غير مطلوبة')],
          },
          { id: 'cariesTreated', type: 'single', options: YES_NO, en: 'Dental caries treated', ar: 'تم علاج النخور' },
          { id: 'cleaningComplete', type: 'single', options: YES_NO, en: 'Cleaning completed', ar: 'تم تنظيف الأسنان' },
          { id: 'fluorideComplete', type: 'single', options: YES_NO, en: 'Fluoride completed if needed', ar: 'تم تطبيق الفلورايد عند الحاجة' },
          { id: 'softTissueFindings', type: 'textarea', span: 'full', en: 'Lips, mucosa, tongue and floor of mouth', ar: 'الشفتان والمخاطية واللسان وأرضية الفم' },
        ],
      },
      {
        id: 'arch',
        en: 'Intra-arch assessment',
        ar: 'تقييم داخل القوس السني',
        fields: [
          { id: 'teethPresent', type: 'text', span: 'full', en: 'Teeth present (FDI)', ar: 'الأسنان الموجودة (FDI)' },
          { id: 'missingTeeth', type: 'text', en: 'Missing teeth (FDI)', ar: 'الأسنان المفقودة (FDI)' },
          { id: 'extractedTeeth', type: 'text', en: 'Extracted teeth (FDI)', ar: 'الأسنان المقلوعة (FDI)' },
          { id: 'supernumeraryTeeth', type: 'text', span: 'full', en: 'Supernumerary teeth', ar: 'الأسنان الزائدة' },
          {
            id: 'upperCrowding', type: 'single', span: 'full',
            en: 'Upper arch crowding', ar: 'الازدحام في الفك العلوي',
            options: [option('none', 'None', 'لا يوجد'), option('mildModerate', 'Mild to moderate', 'خفيف إلى متوسط'), option('severe', 'Severe', 'شديد')],
          },
          {
            id: 'lowerCrowding', type: 'single', span: 'full',
            en: 'Lower arch crowding', ar: 'الازدحام في الفك السفلي',
            options: [option('none', 'None', 'لا يوجد'), option('mildModerate', 'Mild to moderate', 'خفيف إلى متوسط'), option('severe', 'Severe', 'شديد')],
          },
          { id: 'upperSpacing', type: 'number', unit: 'mm', en: 'Upper arch spacing', ar: 'الفراغات في الفك العلوي' },
          { id: 'lowerSpacing', type: 'number', unit: 'mm', en: 'Lower arch spacing', ar: 'الفراغات في الفك السفلي' },
          { id: 'intraoralNotes', type: 'textarea', span: 'full', en: 'Intraoral notes', ar: 'ملاحظات الفحص داخل الفم' },
        ],
      },
    ],
  },
  {
    id: 'occlusion',
    en: 'Occlusal relationships',
    ar: 'علاقات الإطباق',
    groups: [
      {
        id: 'sagittal',
        en: 'Anteroposterior relationship',
        ar: 'العلاقة الأمامية الخلفية',
        fields: [
          { id: 'overjet', type: 'number', unit: 'mm', en: 'Overjet', ar: 'البروز الأفقي' },
          {
            id: 'incisorRelation', type: 'single', span: 'full',
            en: 'Incisor relationship', ar: 'علاقة القواطع',
            options: [
              option('classI', 'Class I', 'صنف I'),
              option('classIIDiv1', 'Class II division 1', 'صنف II تقسيم 1'),
              option('classIIDiv2', 'Class II division 2', 'صنف II تقسيم 2'),
              option('classIII', 'Class III', 'صنف III'),
            ],
          },
          { id: 'rightCanineRelation', type: 'single', options: CLASS_I_II_III, en: 'Right canine relationship', ar: 'علاقة الناب الأيمن' },
          { id: 'leftCanineRelation', type: 'single', options: CLASS_I_II_III, en: 'Left canine relationship', ar: 'علاقة الناب الأيسر' },
          { id: 'rightMolarRelation', type: 'single', options: MOLAR_RELATION, span: 'full', en: 'Right molar relationship', ar: 'علاقة الأرحاء اليمنى' },
          { id: 'leftMolarRelation', type: 'single', options: MOLAR_RELATION, span: 'full', en: 'Left molar relationship', ar: 'علاقة الأرحاء اليسرى' },
        ],
      },
      {
        id: 'vertical',
        en: 'Vertical relationship',
        ar: 'العلاقة العمودية',
        fields: [
          { id: 'overbite', type: 'number', unit: 'mm', en: 'Overbite (negative for open bite)', ar: 'التراكب العمودي (سالب للعضة المفتوحة)' },
          {
            id: 'overbiteType', type: 'single', span: 'full',
            en: 'Overbite classification', ar: 'تصنيف التراكب العمودي',
            options: [option('normal', 'Normal', 'طبيعي'), option('increased', 'Increased / deep bite', 'زائد / عضة عميقة'), option('reduced', 'Reduced', 'ناقص'), option('open', 'Open bite', 'عضة مفتوحة')],
          },
        ],
      },
      {
        id: 'transverse',
        en: 'Transverse relationship & midlines',
        ar: 'العلاقة العرضية وخطوط المنتصف',
        fields: [
          {
            id: 'archCoordination', type: 'single', span: 'full',
            en: 'Arch coordination', ar: 'تناسق القوسين',
            options: [option('coordinated', 'Coordinated', 'متناسقان'), option('notCoordinated', 'Not coordinated', 'غير متناسقين')],
          },
          { id: 'posteriorCrossbite', type: 'single', options: NONE_LEFT_RIGHT, span: 'full', en: 'Posterior crossbite', ar: 'العضة المعكوسة الخلفية' },
          { id: 'scissorBite', type: 'single', options: NONE_LEFT_RIGHT, span: 'full', en: 'Scissor bite', ar: 'العضة المقصّية' },
          { id: 'upperMidlineDeviation', type: 'number', unit: 'mm', en: 'Upper midline to facial midline', ar: 'انحراف الخط العلوي عن خط الوجه' },
          { id: 'upperMidlineDirection', type: 'single', options: NONE_LEFT_RIGHT.slice(0, 3), en: 'Upper deviation direction', ar: 'جهة الانحراف العلوي' },
          { id: 'lowerMidlineDeviation', type: 'number', unit: 'mm', en: 'Lower midline to upper midline', ar: 'انحراف الخط السفلي عن العلوي' },
          { id: 'lowerMidlineDirection', type: 'single', options: NONE_LEFT_RIGHT.slice(0, 3), en: 'Lower deviation direction', ar: 'جهة الانحراف السفلي' },
          { id: 'occlusionNotes', type: 'textarea', span: 'full', en: 'Occlusion notes', ar: 'ملاحظات الإطباق' },
        ],
      },
    ],
  },
  {
    id: 'assessment',
    en: 'Diagnosis & treatment plan',
    ar: 'التشخيص وخطة العلاج',
    groups: [
      {
        id: 'problemDiagnosis',
        en: 'Problem list and diagnosis',
        ar: 'قائمة المشاكل والتشخيص',
        fields: [
          { id: 'problemList', type: 'textarea', span: 'full', en: 'Problem list', ar: 'قائمة المشاكل', placeholder: { en: '1.\n2.\n3.\n4.\n5.', ar: '١.\n٢.\n٣.\n٤.\n٥.' } },
          { id: 'diagnosis', type: 'textarea', span: 'full', en: 'Diagnosis', ar: 'التشخيص' },
          { id: 'treatmentAims', type: 'textarea', span: 'full', en: 'Treatment aims', ar: 'أهداف العلاج', placeholder: { en: '1.\n2.\n3.\n4.', ar: '١.\n٢.\n٣.\n٤.' } },
        ],
      },
      {
        id: 'plan',
        en: 'Treatment plan summary',
        ar: 'ملخص خطة العلاج',
        fields: [
          { id: 'treatmentPlanSummary', type: 'textarea', span: 'full', en: 'Treatment plan summary', ar: 'ملخص خطة العلاج' },
          {
            id: 'treatmentMeans', type: 'multi', span: 'full',
            en: 'Means of treatment', ar: 'وسائل العلاج',
            options: [
              option('fixed', 'Fixed orthodontic appliance', 'جهاز تقويم ثابت'),
              option('removable', 'Removable orthodontic appliance', 'جهاز تقويم متحرك'),
              option('extraction', 'Extraction', 'قلع'),
              option('nonExtraction', 'Non-extraction', 'بدون قلع'),
              option('growthModification', 'Growth modification', 'تعديل النمو'),
              option('orthognathicSurgery', 'Orthognathic surgery', 'جراحة تقويم الفكين'),
            ],
          },
          { id: 'applianceName', type: 'text', span: 'full', en: 'Appliance name', ar: 'اسم الجهاز' },
          { id: 'activeComponents', type: 'textarea', en: 'Active components', ar: 'المكوّنات الفعالة' },
          { id: 'retentiveComponents', type: 'textarea', en: 'Retentive components', ar: 'مكوّنات التثبيت' },
          { id: 'assessmentNotes', type: 'textarea', span: 'full', en: 'Additional plan notes', ar: 'ملاحظات إضافية للخطة' },
        ],
      },
    ],
  },
]

export const ORTHO_FIELDS = ORTHO_SECTIONS.flatMap((section) =>
  section.groups.flatMap((group) => group.fields)
)

export function orthoValueLabel(field, value, lang = 'en') {
  if (value === '' || value == null || (Array.isArray(value) && value.length === 0)) return ''
  const label = (key) => field.options?.find((item) => item.key === key)?.[lang] || key
  const displayed = Array.isArray(value) ? value.map(label).join(lang === 'ar' ? '، ' : ', ') : field.options ? label(value) : value
  return field.unit && displayed !== '' ? `${displayed} ${field.unit}` : String(displayed)
}
