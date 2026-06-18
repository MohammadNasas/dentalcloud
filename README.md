# 🦷 DentaCare — نظام إدارة عيادات الأسنان / Dental Clinic Management

تطبيق احترافي لإدارة عيادات الأسنان، ثنائي اللغة (عربي/إنجليزي)، بثلاث باقات.
A professional, bilingual (Arabic/English) dental-clinic management app with three plans.

---

## ▶️ التشغيل / How to run

### الطريقة السهلة / Easy way (Windows)
انقر نقراً مزدوجاً على الملف:  **`تشغيل-التطبيق.bat`**
Double-click **`تشغيل-التطبيق.bat`** — it installs everything the first time and opens the app in your browser.

### يدوياً / Manually
```bash
npm install      # أول مرة فقط / first time only
npm run dev      # ثم افتح / then open  http://localhost:5173
```

> 💡 يظهر الرابط الشبكي (Network) في الطرفية، استخدمه لفتح التطبيق من **أي جهاز** على نفس الشبكة (موبايل/تابلت).
> The terminal also prints a **Network** URL — open it from any phone/tablet on the same Wi‑Fi.

---

## 🔑 حساب تجريبي / Demo login
| | |
|---|---|
| اسم المستخدم / Username | `sara` |
| كلمة المرور / Password | `1234` |

طبيب ثانٍ / second doctor: `omar` / `1234`

يمكنك أيضاً إنشاء حساب عيادة جديد من شاشة الدخول.
You can also create a brand-new clinic account from the login screen.

---

## 📦 الباقات / Plans
| الباقة / Plan | السعر / Price | |
|---|---|---|
| 🎓 الطالب / Student | **$5** | السجلات، التاريخ الطبي، مخطط الأسنان، تصدير Word |
| 🏢 التوفيرية / Economy | **$70** | + المواعيد، تعدد الأطباء، اللثة، مؤشر اللويحة، الأسعار، التذكيرات |
| 👑 الاحترافية / Pro | **$100** | + الصور والأشعة، التقارير، الدفع المقسّم، تعليمات الطباعة |

غيّر الباقة في أي وقت من صفحة **الباقات**.
Switch plans anytime from the **Packages** page.

---

## ✨ أهم المزايا / Key features
- 🦷 مخطط أسنان تفاعلي (دائمة 1–8 / لبنية A–E) — حالات وعلاجات بالألوان، أسطح، أصناف G.V. Black، وفصل بين الحالة الحالية والعلاج المنجز.
- 📅 تقويم موحّد لكل المواعيد مع لون لكل طبيب.
- 🩺 تاريخ طبي وسنّي كامل + تنبيهات طبية ذكية (حساسية/أمراض خطرة).
- ⭐ اقتراح «أهم 3 أسنان للعلاج» بعد الفحص.
- 🧾 مخطط اللثة + مؤشر اللويحة (O'Leary).
- 💳 مدفوعات واضحة (نقد/بطاقة/تأمين/شيك + دمج) و«مَن عليه رصيد وكم».
- 📄 تصدير ملف Word لكل مريض أو لكل المرضى (للتحويل لطبيب آخر).
- 🖨️ تعليمات علاج قابلة للطباعة والتعديل لكل إجراء.
- 📸 صور قبل/بعد وأشعة (باقة Pro).
- 📊 تقرير شهري عن أداء العيادة والدخل.

---

## ☁️ التشغيل أونلاين (حسابات للجميع) / Go online
التطبيق جاهز للربط بـ **Supabase** بحيث الحساب يشتغل على الموقع وعلى التطبيق بنفس البيانات.
اتبع الدليل: **[`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)** (~10 دقائق، بدون برمجة).

- بدون إعداد `.env` → التطبيق يشتغل **محلياً (تجريبي)** بدون إنترنت.
- مع `.env` (مفاتيح Supabase) → يصير **متصل**: تسجيل، حسابات، ومزامنة web + desktop.

## 🛠️ التقنيات / Tech
React + Vite + TailwindCSS + Framer Motion + Recharts + docx + Electron + Supabase.
الوضع المحلي: localStorage + IndexedDB. الوضع السحابي: Supabase (Postgres + Auth + RLS).
