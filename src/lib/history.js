// ──────────────────────────────────────────────────────────────────────────
//  Medical & dental history schema. Data-driven so the same definition powers
//  the on-screen form AND the Word/print export. Based on the clinic's paper
//  template, expanded with commonly-required items (diabetes, hypertension,
//  anticoagulants, prosthetic valves, bisphosphonates, etc.).
//
//  Field types:
//    toggle  → yes / no
//    text    → free text
//    checks  → multiple-choice (options array of {key,en,ar})
// ──────────────────────────────────────────────────────────────────────────

const opt = (key, en, ar) => ({ key, en, ar })

export const DENTAL_HISTORY = {
  id: 'dental',
  title: { en: 'Dental History', ar: 'التاريخ السنّي' },
  fields: [
    { id: 'prevTreatment', type: 'toggle', en: 'Had dental treatment before?', ar: 'هل قمت بعلاجات لأسنانك من قبل؟' },
    { id: 'badExperience', type: 'toggle', en: 'Any bad/painful dental experience?', ar: 'هل مررت بتجربة سيئة أو مؤلمة عند طبيب الأسنان؟' },
    { id: 'facialInjury', type: 'toggle', en: 'Injury to face / jaws?', ar: 'هل تعرّضت لإصابة في الوجه أو الفكين؟' },
    { id: 'dryMouth', type: 'toggle', en: 'Dry mouth?', ar: 'هل تشعر بجفاف في الفم؟' },
    { id: 'anesthesiaAllergy', type: 'toggle', en: 'Allergy to dental anesthesia?', ar: 'هل لديك حساسية من تخدير الأسنان؟' },
    { id: 'grinding', type: 'toggle', en: 'Grind / clench teeth at night?', ar: 'هل تعضّ / تجزّ على أسنانك ليلاً؟' },
    { id: 'bleedingGums', type: 'toggle', en: 'Bleeding gums when brushing?', ar: 'هل تنزف لثتك عند التنظيف؟' },
    { id: 'brushingFreq', type: 'checks', en: 'Brushing frequency', ar: 'عدد مرات التنظيف', options: [
      opt('once', 'Once a day', 'مرة يومياً'),
      opt('twice', 'Twice a day', 'مرتين يومياً'),
      opt('irregular', 'Irregular', 'غير منتظم'),
      opt('floss', 'Uses floss', 'يستخدم الخيط'),
    ]},
    { id: 'dentalNotes', type: 'text', en: 'Clarify any positive answer', ar: 'توضيح أي إجابة إيجابية' },
  ],
}

export const MEDICAL_HISTORY = {
  id: 'medical',
  title: { en: 'Medical History', ar: 'التاريخ المرضي' },
  fields: [
    { id: 'recentIllness', type: 'toggle', en: 'Any recent illness?', ar: 'هل أصابتك وعكة صحية مؤخراً؟' },
    { id: 'underCare', type: 'toggle', en: 'Regularly under a physician’s care?', ar: 'هل تتابع مع طبيب بشكل منتظم؟' },
    { id: 'majorSurgery', type: 'toggle', en: 'Had major / risky operations?', ar: 'هل أجريت عمليات كبيرة أو خطرة؟' },
    { id: 'hospitalized', type: 'toggle', en: 'Hospitalized recently?', ar: 'هل دخلت المستشفى مؤخراً؟' },
    { id: 'pregnant', type: 'toggle', en: 'Pregnant / breastfeeding?', ar: 'هل أنتِ حامل / مرضع؟' },
    { id: 'mouthBreathing', type: 'toggle', en: 'Mouth breathing?', ar: 'هل تتنفس من فمك؟' },
  ],
}

// System-by-system review — each entry becomes a card with multi-checks.
export const SYSTEMS_HISTORY = {
  id: 'systems',
  title: { en: 'Systemic Review', ar: 'المراجعة حسب الأجهزة' },
  groups: [
    { id: 'cardio', en: 'Heart & circulation', ar: 'القلب والدورة الدموية', options: [
      opt('hypertension', 'Hypertension', 'ارتفاع ضغط الدم'),
      opt('heartFailure', 'Heart failure', 'فشل في القلب'),
      opt('mi', 'Heart attack (MI)', 'نوبة قلبية'),
      opt('angina', 'Angina / narrowed arteries', 'ذبحة / تضيّق شرايين'),
      opt('congenital', 'Congenital heart disease', 'مرض قلبي خلقي'),
      opt('valve', 'Prosthetic valve / endocarditis risk', 'صمام صناعي / خطر التهاب شغاف'),
      opt('rheumatic', 'Rheumatic fever', 'حمّى رثوية'),
      opt('pacemaker', 'Pacemaker', 'ناظمة قلبية'),
    ]},
    { id: 'endocrine', en: 'Endocrine & metabolic', ar: 'الغدد والاستقلاب', options: [
      opt('diabetes1', 'Diabetes — Type 1', 'سكري — النوع الأول'),
      opt('diabetes2', 'Diabetes — Type 2', 'سكري — النوع الثاني'),
      opt('thyroid', 'Thyroid disorder', 'اضطراب الغدة الدرقية'),
      opt('osteoporosis', 'Osteoporosis / bisphosphonates', 'هشاشة عظام / بايفوسفونات'),
      opt('adrenal', 'Adrenal / steroid therapy', 'كظر / علاج بالكورتيزون'),
    ]},
    { id: 'blood', en: 'Blood', ar: 'الدم', options: [
      opt('anemia', 'Anemia', 'فقر دم'),
      opt('hemophilia', 'Hemophilia / bleeding disorder', 'هيموفيليا / اضطراب نزف'),
      opt('leukemia', 'Leukemia', 'سرطان الدم'),
      opt('anticoagulant', 'On blood thinners (warfarin/aspirin)', 'مميّعات دم (وارفارين/أسبرين)'),
      opt('transfusion', 'Recent transfusion', 'نقل دم مؤخراً'),
    ]},
    { id: 'respiratory', en: 'Respiratory', ar: 'الجهاز التنفسي', options: [
      opt('asthma', 'Asthma', 'ربو'),
      opt('copd', 'COPD', 'انسداد رئوي مزمن'),
      opt('tb', 'Tuberculosis', 'سل'),
      opt('sleepApnea', 'Sleep apnea', 'انقطاع نفس نومي'),
      opt('nasalObstructionFull', 'Complete nasal obstruction', 'انسداد كلي بالأنف'),
      opt('nasalObstructionPartial', 'Partial nasal obstruction', 'انسداد جزئي بالأنف'),
    ]},
    { id: 'gi', en: 'Stomach & liver', ar: 'المعدة والكبد', options: [
      opt('ulcer', 'Peptic ulcer', 'قرحة معدية'),
      opt('gerd', 'Acid reflux (GERD)', 'ارتجاع مريئي'),
      opt('hepatitis', 'Hepatitis', 'التهاب كبد'),
      opt('liver', 'Liver disease', 'مرض كبدي'),
    ]},
    { id: 'neuro', en: 'Nervous system', ar: 'الجهاز العصبي', options: [
      opt('epilepsy', 'Epilepsy / seizures', 'صرع / اختلاجات'),
      opt('parkinson', 'Parkinson’s', 'باركنسون'),
      opt('stroke', 'Stroke', 'جلطة دماغية'),
      opt('psychiatric', 'Psychiatric condition', 'حالة نفسية'),
    ]},
    { id: 'renal', en: 'Kidney', ar: 'الكلية', options: [
      opt('renalFailure', 'Kidney failure', 'فشل كلوي'),
      opt('dialysis', 'On dialysis', 'غسيل كلى'),
    ]},
    { id: 'immune', en: 'Immune & other', ar: 'المناعة وأخرى', options: [
      opt('hiv', 'HIV', 'فيروس العوز المناعي'),
      opt('autoimmune', 'Autoimmune disease', 'مرض مناعي ذاتي'),
      opt('cancer', 'Cancer (specify)', 'سرطان (حدّد)'),
      opt('radiotherapy', 'Head/neck radiotherapy', 'علاج إشعاعي للرأس/الرقبة'),
    ]},
  ],
}

export const ALLERGIES = {
  id: 'allergies',
  title: { en: 'Allergies', ar: 'الحساسية' },
  options: [
    opt('penicillin', 'Penicillin / antibiotics', 'بنسلين / مضادات حيوية'),
    opt('localAnesthetic', 'Local anesthetic', 'مخدر موضعي'),
    opt('aspirin', 'Aspirin / NSAIDs', 'أسبرين / مضادات التهاب'),
    opt('latex', 'Latex', 'لاتكس'),
    opt('iodine', 'Iodine', 'يود'),
    opt('metals', 'Metals / nickel', 'معادن / نيكل'),
    opt('food', 'Food', 'طعام'),
    opt('other', 'Other', 'أخرى'),
  ],
}

export const MEDICATIONS = {
  id: 'medications',
  title: { en: 'Current Medications', ar: 'الأدوية الحالية' },
  options: [
    opt('anticoagulants', 'Blood thinners / anticoagulants', 'مميّعات دم'),
    opt('antihypertensives', 'Blood pressure medicine', 'أدوية ضغط'),
    opt('insulin', 'Insulin / anti-diabetic', 'إنسولين / خافض سكر'),
    opt('bisphosphonates', 'Bisphosphonates', 'بايفوسفونات'),
    opt('steroids', 'Steroids / cortisone', 'كورتيزون'),
    opt('immunosuppressants', 'Immunosuppressants', 'مثبّطات مناعة'),
    opt('contraceptives', 'Oral contraceptives', 'حبوب منع حمل'),
    opt('antidepressants', 'Antidepressants', 'مضادات اكتئاب'),
    opt('inhalers', 'Inhalers', 'بخّاخات'),
    opt('other', 'Other', 'أخرى'),
  ],
}

export const SOCIAL_HISTORY = {
  id: 'social',
  title: { en: 'Social History', ar: 'العادات' },
  fields: [
    { id: 'smoking', type: 'toggle', en: 'Smoking?', ar: 'هل تدخّن؟' },
    { id: 'smokingType', type: 'text', en: 'Type & amount per day', ar: 'النوع والكمية يومياً' },
    { id: 'alcohol', type: 'toggle', en: 'Alcohol?', ar: 'هل تتناول الكحول؟' },
  ],
}

// Clinical examination — mirrors the English exam section of the template.
export const CLINICAL_EXAM = {
  id: 'exam',
  title: { en: 'Clinical Examination', ar: 'الفحص السريري' },
  sections: [
    { id: 'tmj', en: 'TMJ', ar: 'المفصل الفكي الصدغي', type: 'checks', options: [
      opt('deviation', 'Deviation', 'انحراف'),
      opt('clicking', 'Clicking', 'طقطقة'),
      opt('tenderness', 'Tenderness on palpation', 'ألم بالجس'),
    ]},
    { id: 'lymph', en: 'Lymph nodes', ar: 'العقد اللمفية', type: 'checks', options: [
      opt('tender', 'Tender', 'مؤلمة'),
      opt('enlarged', 'Enlarged', 'متضخمة'),
    ]},
    { id: 'lips', en: 'Lip competency', ar: 'كفاءة الشفاه', type: 'checks', options: [
      opt('competent', 'Competent', 'كفؤة'),
      opt('incompetent', 'Incompetent', 'غير كفؤة'),
    ]},
    { id: 'incisal', en: 'Incisal classification', ar: 'التصنيف الإطباقي', type: 'checks', options: [
      opt('class1', 'Class I', 'الصنف الأول'),
      opt('class2d1', 'Class II div 1', 'الصنف الثاني قسم 1'),
      opt('class2d2', 'Class II div 2', 'الصنف الثاني قسم 2'),
      opt('class3', 'Class III', 'الصنف الثالث'),
    ]},
    { id: 'overjet', en: 'Overjet (mm)', ar: 'البروز الأفقي (مم)', type: 'text' },
    { id: 'overbite', en: 'Overbite (mm)', ar: 'التغطية العمودية (مم)', type: 'text' },
    { id: 'hardPalate', en: 'Hard palate', ar: 'الحنك الصلب', type: 'checks', options: [
      opt('normal', 'Normal', 'طبيعي'),
      opt('stomatitis', 'Stomatitis', 'التهاب فموي'),
      opt('ulcer', 'Ulcer', 'قرحة'),
      opt('tori', 'Tori', 'نتوء عظمي'),
    ]},
    { id: 'buccalMucosa', en: 'Buccal mucosa', ar: 'الغشاء المخاطي الشدقي', type: 'checks', options: [
      opt('normal', 'Normal', 'طبيعي'),
      opt('pigmentation', 'Pigmentation', 'تصبّغ'),
      opt('ulceration', 'Ulceration', 'تقرّح'),
      opt('lineaAlba', 'Linea alba', 'الخط الأبيض'),
    ]},
    { id: 'tongue', en: 'Tongue position notes', ar: 'ملاحظات على وضع اللسان', type: 'text' },
    { id: 'softTissue', en: 'Soft tissue / floor of mouth notes', ar: 'ملاحظات الأنسجة الرخوة / أرضية الفم', type: 'text' },
  ],
}

export const ALL_HISTORY_SECTIONS = [
  DENTAL_HISTORY,
  MEDICAL_HISTORY,
  SOCIAL_HISTORY,
]

// ── Dental considerations per medical condition ────────────────────────────
// Shown to the dentist when a condition is selected. Concise standard guidance.
const C = (en, ar) => ({ en, ar })
export const DENTAL_CONSIDERATIONS = {
  hypertension: C(
    ['Measure blood pressure before invasive procedures; postpone elective care if >180/110.', 'Limit epinephrine in local anaesthetic; avoid long-term NSAIDs.', 'Rise the patient slowly (orthostatic hypotension).'],
    ['قِس ضغط الدم قبل الإجراءات الجراحية؛ أجّل العلاج الاختياري إذا >180/110.', 'قلّل الأدرينالين في المخدر؛ تجنّب مضادات الالتهاب طويلاً.', 'أنهض المريض ببطء (هبوط ضغط انتصابي).']),
  mi: C(
    ['Defer elective dental care for 6 months after a recent heart attack.', 'Short, stress-free visits; limit epinephrine; keep nitroglycerin available.'],
    ['أجّل العلاج الاختياري 6 أشهر بعد نوبة قلبية حديثة.', 'جلسات قصيرة وخالية من التوتر؛ قلّل الأدرينالين؛ جهّز النتروغليسرين.']),
  angina: C(
    ['Keep appointments short; have the patient’s nitroglycerin nearby.', 'Limit epinephrine; treat semi-upright; reduce stress.'],
    ['اجعل الجلسات قصيرة وجهّز نتروغليسرين المريض.', 'قلّل الأدرينالين؛ عالج بوضع شبه جالس؛ قلّل التوتر.']),
  valve: C(
    ['Antibiotic prophylaxis may be required before bleeding procedures — confirm with the cardiologist (AHA regimen).', 'Maintain meticulous oral hygiene to reduce bacteraemia.'],
    ['قد يلزم مضاد حيوي وقائي قبل الإجراءات النازفة — أكّد مع طبيب القلب (بروتوكول AHA).', 'حافظ على نظافة فموية دقيقة لتقليل تجرثم الدم.']),
  rheumatic: C(
    ['Prior rheumatic fever with valve damage may need antibiotic prophylaxis — confirm with physician.'],
    ['الحمّى الرثوية السابقة مع أذية صمام قد تحتاج مضاداً وقائياً — أكّد مع الطبيب.']),
  pacemaker: C(
    ['Most modern pacemakers are shielded; confirm with cardiologist before using electrosurgery/ultrasonic scalers.'],
    ['أغلب النواظم الحديثة معزولة؛ أكّد مع طبيب القلب قبل استخدام الكي الكهربائي/المقلّحات فوق الصوتية.']),
  diabetes1: C(
    ['Morning appointments after meals & medication to avoid hypoglycaemia; keep a sugar source ready.', 'Poor control delays healing and raises infection risk; treat periodontal disease aggressively.'],
    ['مواعيد صباحية بعد الأكل والدواء لتجنّب هبوط السكر؛ جهّز مصدر سكر.', 'ضبط السكر السيئ يؤخر الشفاء ويزيد الالتهاب؛ عالج اللثة بقوة.']),
  diabetes2: C(
    ['Schedule after meals/medication; watch for hypoglycaemia.', 'Manage periodontitis (two-way link); expect slower healing if poorly controlled.'],
    ['جدول المواعيد بعد الأكل/الدواء؛ انتبه لهبوط السكر.', 'عالج التهاب اللثة (علاقة متبادلة)؛ توقّع شفاءً أبطأ مع ضبط سيئ.']),
  thyroid: C(
    ['Uncontrolled hyperthyroidism: avoid epinephrine (thyroid storm risk).', 'Hypothyroid patients are sensitive to sedatives — use cautiously.'],
    ['فرط درقية غير مضبوط: تجنّب الأدرينالين (خطر العاصفة الدرقية).', 'قصور الدرقية: حساسية للمهدئات — استخدمها بحذر.']),
  osteoporosis: C(
    ['Bisphosphonates → risk of jaw osteonecrosis (MRONJ), especially IV — avoid/limit extractions & bone surgery.', 'Record drug name, route and duration; consult physician before surgery.'],
    ['البايفوسفونات → خطر تنخّر عظم الفك (MRONJ) خاصة الوريدي — تجنّب/قلّل القلع وجراحة العظم.', 'سجّل اسم الدواء وطريقته ومدته؛ استشر الطبيب قبل الجراحة.']),
  adrenal: C(
    ['Long-term steroids may need supplementation for major procedures (adrenal crisis risk) — confirm dose with physician.'],
    ['الكورتيزون طويل الأمد قد يحتاج جرعة داعمة قبل الإجراءات الكبيرة (خطر القصور الكظري) — أكّد الجرعة مع الطبيب.']),
  anemia: C(
    ['Defer elective care in severe anaemia; ensure good oxygenation with any sedation.'],
    ['أجّل العلاج الاختياري في فقر الدم الشديد؛ تأكّد من الأكسجة عند أي تهدئة.']),
  hemophilia: C(
    ['High bleeding risk — coordinate with haematologist before any surgery; may need factor replacement + local haemostasis.'],
    ['خطر نزف مرتفع — نسّق مع طبيب الدم قبل أي جراحة؛ قد يلزم تعويض العامل + إرقاء موضعي.']),
  leukemia: C(
    ['Bleeding, infection and mucositis risk — coordinate with oncologist; defer elective care during active disease.'],
    ['خطر نزف وعدوى والتهاب مخاطية — نسّق مع طبيب الأورام؛ أجّل العلاج الاختياري أثناء المرض الفعّال.']),
  anticoagulant: C(
    ['Do NOT stop blood thinners without the physician’s advice.', 'Check INR (warfarin) before surgery; minor surgery usually safe if INR <3.5; use sutures/haemostatics.'],
    ['لا توقف مميّعات الدم دون استشارة الطبيب.', 'افحص INR (وارفارين) قبل الجراحة؛ الجراحة البسيطة آمنة عادة إذا <3.5؛ استخدم الخياطة والمرقئات.']),
  asthma: C(
    ['Ensure the patient brings their inhaler; avoid aspirin/NSAIDs if sensitive; reduce stress triggers.'],
    ['تأكّد أن المريض أحضر بخّاخه؛ تجنّب الأسبرين/مضادات الالتهاب عند الحساسية؛ قلّل محفّزات التوتر.']),
  copd: C(
    ['Treat semi-upright (not supine); use sedatives/oxygen cautiously (CO₂ retention).'],
    ['عالج بوضع شبه جالس (ليس مستلقياً)؛ استخدم المهدئات/الأكسجين بحذر (احتباس CO₂).']),
  tb: C(
    ['Active TB: defer elective care and use airborne precautions / refer; treat when non-infectious.'],
    ['السل الفعّال: أجّل العلاج الاختياري واستخدم احتياطات العدوى الهوائية / حوّل؛ عالج عند زوال العدوى.']),
  hepatitis: C(
    ['Possible impaired drug metabolism and bleeding (liver); check LFTs; standard infection control for everyone.'],
    ['احتمال ضعف استقلاب الأدوية ونزف (الكبد)؛ افحص وظائف الكبد؛ ضبط عدوى قياسي للجميع.']),
  liver: C(
    ['Reduced drug metabolism and clotting factors — adjust doses and assess bleeding risk.'],
    ['نقص استقلاب الأدوية وعوامل التخثّر — عدّل الجرعات وقيّم خطر النزف.']),
  epilepsy: C(
    ['Confirm medication taken; phenytoin causes gingival overgrowth (stress hygiene); be ready to manage a seizure.'],
    ['تأكّد من أخذ الدواء؛ الفينيتوين يسبّب تضخّم لثة (شدّد على النظافة)؛ كن مستعداً لإدارة نوبة.']),
  parkinson: C(
    ['Tremor/rigidity complicates care — support the head, shorter visits; watch postural hypotension & drug interactions.'],
    ['الرعاش/التيبّس يصعّب العلاج — اسند الرأس، جلسات أقصر؛ انتبه لهبوط الضغط الانتصابي وتداخل الأدوية.']),
  stroke: C(
    ['Defer elective care 6 months post-stroke; many patients are anticoagulated — check; short low-stress visits.'],
    ['أجّل العلاج الاختياري 6 أشهر بعد الجلطة؛ كثيرون على مميّعات — تحقّق؛ جلسات قصيرة قليلة التوتر.']),
  psychiatric: C(
    ['Review meds (interactions with epinephrine/sedatives); many cause dry mouth → higher caries risk.'],
    ['راجع الأدوية (تداخل مع الأدرينالين/المهدئات)؛ كثير منها يسبّب جفاف فم → خطر تسوّس أعلى.']),
  renalFailure: C(
    ['Avoid nephrotoxic drugs (NSAIDs); adjust drug doses; assess bleeding/infection risk.'],
    ['تجنّب الأدوية السامة للكلى (مضادات الالتهاب)؛ عدّل جرعات الأدوية؛ قيّم خطر النزف/العدوى.']),
  dialysis: C(
    ['Treat the day AFTER dialysis (not the same day); avoid the AV-fistula arm for BP; bleeding tendency.'],
    ['عالج في اليوم التالي للغسيل (ليس نفس اليوم)؛ تجنّب ذراع الناسور لقياس الضغط؛ ميل للنزف.']),
  hiv: C(
    ['Standard infection control (as with all patients); watch oral lesions (candidiasis, hairy leukoplakia); assess immune status.'],
    ['ضبط عدوى قياسي (كأي مريض)؛ راقب الآفات الفموية (مبيضّات، طلاوة مشعّرة)؛ قيّم الحالة المناعية.']),
  autoimmune: C(
    ['May be immunosuppressed (infection/healing concerns); confirm steroid/immunosuppressant use; possible oral lesions.'],
    ['قد يكون مثبّط مناعة (مخاوف عدوى/شفاء)؛ أكّد استخدام الكورتيزون/مثبّطات المناعة؛ آفات فموية محتملة.']),
  cancer: C(
    ['Coordinate with oncologist; complete dental clearance before chemo/radiotherapy; manage mucositis & xerostomia.'],
    ['نسّق مع طبيب الأورام؛ أكمل التهيئة السنية قبل الكيماوي/الإشعاع؛ عالج التهاب المخاطية وجفاف الفم.']),
  radiotherapy: C(
    ['AVOID extractions in irradiated jaw bone (osteoradionecrosis risk); pre-radiation dental clearance is essential; fluoride for xerostomia caries.'],
    ['تجنّب القلع في عظم الفك المُشعَّع (خطر تنخّر عظمي إشعاعي)؛ التهيئة السنية قبل الإشعاع ضرورية؛ الفلورايد لتسوّس جفاف الفم.']),
  pregnancy: C(
    ['Safest in the 2nd trimester; tilt to the left (avoid supine hypotension); shield for radiographs; avoid tetracyclines & 3rd-trimester NSAIDs.'],
    ['الأكثر أماناً في الثلث الثاني؛ أمِل المريضة لليسار (تجنّب هبوط الضغط الاستلقائي)؛ درع واقٍ للأشعة؛ تجنّب التتراسيكلين ومضادات الالتهاب بالثلث الأخير.']),
}
