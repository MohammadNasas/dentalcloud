import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HelpCircle, Plus } from 'lucide-react'
import { useReduceMotion } from '../lib/motionPref'

const questions = {
  ar: [
    ['كيف يمكن تنظيم مواعيد عدة أطباء في العيادة؟', 'يتيح DentalCloud عرض مواعيد الأطباء ضمن تقويم موحّد، مع لون مميز لكل طبيب لتسهيل متابعة الحجوزات وتنظيم جدول العمل.'],
    ['كيف أتابع المدفوعات والمبالغ المستحقة لكل مريض؟', 'يمكنك تسجيل تكاليف العلاج والدفعات في ملف المريض، والاطلاع على إجمالي المبالغ المدفوعة والرصيد المتبقي.'],
    ['هل يمكن الرجوع إلى سجل المريض والعلاجات السابقة؟', 'نعم، يجمع ملف المريض تاريخه الطبي والسنّي والعلاجات المسجّلة ومخططات الأسنان والصور، لتسهيل مراجعة حالته ومتابعة العلاج.'],
    ['ما الفرق بين باقة الطالب والباقة الاحترافية؟', 'توفّر باقة الطالب مجاناً أدوات توثيق الحالات، بما فيها ملفات المرضى ومخططات الأسنان واللثة. وتضيف الباقة الاحترافية أدوات إدارة العيادة، مثل تنظيم المواعيد ومتابعة المدفوعات وإدارة عدة أطباء.'],
    ['ما فائدة مخطط الأسنان التفاعلي في توثيق الحالات؟', 'يتيح المخطط توثيق حالة كل سن والعلاجات المرتبطة به بصورة مرئية ومنظّمة، مما يسهّل مراجعة المعلومات إلى جانب الملاحظات السريرية.'],
  ],
  en: [
    ['How can I organise appointments for multiple dentists?', 'DentalCloud brings your dentists’ appointments together in one calendar, with a distinct colour for each dentist to make bookings and daily schedules easier to follow.'],
    ['How do I track each patient’s payments and outstanding balance?', 'Record treatment fees and payments in the patient’s file, and review the total amount paid and the remaining balance.'],
    ['Can I review a patient’s history and previous treatments?', 'Yes. The patient’s file brings together their medical and dental history, recorded treatments, dental charts and images to support case review and ongoing care.'],
    ['What is the difference between the Student and Pro plans?', 'The free Student plan includes tools for documenting cases, including patient records and dental and periodontal charts. The Pro plan adds clinic management tools such as appointment scheduling, payment tracking and managing multiple dentists.'],
    ['How does the interactive dental chart help document cases?', 'The chart provides an organised visual record of each tooth’s condition and associated treatments, making information easier to review alongside clinical notes.'],
  ],
}

export default function LandingFAQ({ ar }) {
  const [open, setOpen] = useState(0)
  const id = useId()
  const reduced = useReducedMotion()
  const [performance] = useReduceMotion()

  return <section className="landing-faq mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby={`${id}-title`}>
    <div className="landing-faq-panel">
      <div className="landing-faq-intro">
        <span className="landing-faq-symbol" aria-hidden="true"><HelpCircle size={26}/></span>
        <p className="mt-5 text-xs font-bold text-brand-700">{ar ? 'تعرّف على DentalCloud' : 'Get to know DentalCloud'}</p>
        <h2 id={`${id}-title`} className="mt-3 text-3xl font-extrabold leading-snug text-ink-800">{ar ? 'أسئلة شائعة' : 'Frequently asked questions'}</h2>
        <p className="mt-4 text-sm leading-7 text-ink-500">{ar ? 'إجابات واضحة حول إدارة عيادتك، وتوثيق الحالات، واختيار الباقة المناسبة.' : 'Clear answers about managing your clinic, documenting cases and choosing the right plan.'}</p>
        <div className="landing-faq-intro-line" aria-hidden="true"/>
      </div>
      <div className="space-y-3">
        {questions[ar ? 'ar' : 'en'].map(([question, answer], index) => {
          const expanded = open === index
          return <article key={index} className="landing-faq-card" data-open={expanded}>
            <h3>
              <button type="button" id={`${id}-question-${index}`} aria-expanded={expanded} aria-controls={`${id}-answer-${index}`} onClick={() => setOpen(expanded ? null : index)} className="landing-faq-trigger">
                <span className="landing-faq-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="flex-1">{question}</span>
                <span className="landing-faq-toggle" aria-hidden="true"><Plus size={17}/></span>
              </button>
            </h3>
            <div id={`${id}-answer-${index}`} role="region" aria-labelledby={`${id}-question-${index}`}>
              <AnimatePresence initial={false}>
                {expanded && <motion.div key="answer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced || performance ? 0 : .2 }} className="overflow-hidden">
                  <p className="landing-faq-answer">{answer}</p>
                </motion.div>}
              </AnimatePresence>
            </div>
          </article>
        })}
      </div>
    </div>
  </section>
}
