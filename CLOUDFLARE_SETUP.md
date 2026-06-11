# نشر DentalCloud على Cloudflare Pages (مجاني للأبد)

موقعك React (Vite) + وظائف الدفع (MyFatoorah) + Supabase — كله بيشتغل على Cloudflare Pages
بدون "رصيد" ولا تجارب ولا إيقاف نشر. هاي الخطوات لمرة وحدة.

## 1) أنشئ المشروع
1. سجّل/ادخل على https://dash.cloudflare.com → من اليسار: **Workers & Pages**.
2. **Create application** → تبويب **Pages** → **Connect to Git**.
3. اربط حساب GitHub واختر مستودع **`MohammadNasas/dentacare`** → **Begin setup**.

## 2) إعدادات البناء (Build settings)
| الحقل | القيمة |
|---|---|
| Framework preset | **None** (أو Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (افتراضي، فاضي) |

## 3) متغيّرات البيئة (Environment variables)
أضِفها كلها تحت **Production** (و**Preview** إذا حاب). انسخ القيم من Netlify
(Site settings → Environment variables) أو من Supabase / MyFatoorah:

| المتغيّر | لوين بيُستعمل | القيمة |
|---|---|---|
| `VITE_SUPABASE_URL` | بناء الواجهة | رابط مشروع Supabase |
| `VITE_SUPABASE_ANON_KEY` | بناء الواجهة | مفتاح anon العام |
| `SUPABASE_URL` | وظائف الدفع | نفس رابط Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | وظائف الدفع | مفتاح service_role (**سرّي!**) |
| `LAHZA_SECRET_KEY` | وظائف الدفع | المفتاح السرّي من Lahza — تجريبي `sk_test_…` أو حقيقي `sk_live_…` (**سرّي!**) |
| `LAHZA_BASE` | وظائف الدفع | `https://api.lahza.io` (اختياري — هو الافتراضي) |
| `LAHZA_CURRENCY` | وظائف الدفع | `USD` (اختياري؛ المدعوم: USD/ILS/JOD) |
| `NODE_VERSION` | البناء | `20` (موجود بـ `.nvmrc` كمان) |
| `SITE_URL` | وظائف الدفع | اختياري — بياخد رابط الموقع تلقائياً |

> 🔒 مفتاح `service_role` سرّي — موجود بس هون بإعدادات Cloudflare، أبداً مش بالكود.

## 4) انشر
اضغط **Save and Deploy**. أول بناء بياخد دقيقة-دقيقتين. بيطلعلك رابط زي:
`https://dentacare-xxx.pages.dev`

## 5) (لاحقاً) دومين خاص
Pages → مشروعك → **Custom domains** لو بدك دومين باسمك. بعدها حُط نفس الدومين
بمتغيّر `SITE_URL` لو حبيت تثبّته.

## 6) التبديل للوضع الحقيقي (Live) — بدون أي تعديل كود
بوابة الدفع هي **Lahza (لحظة)** عبر `https://api.lahza.io`. الفرق الوحيد بين التجريبي
والحقيقي هو **المفتاح السرّي** — ما في تغيير كود ولا رابط:

1. من لوحة Lahza (`dashboard.lahza.io`) → **Settings → API Keys**:
   - المفتاح التجريبي بيبدأ بـ `sk_test_…`
   - المفتاح الحقيقي بيبدأ بـ `sk_live_…`
2. على Cloudflare (مشروعك → **Settings → Environment variables → Production**) حُط:
   - `LAHZA_SECRET_KEY` = المفتاح الحقيقي `sk_live_…`
   - `LAHZA_CURRENCY` = `USD` (أو `ILS` / `JOD`)
   - `LAHZA_BASE` مش لازم — الافتراضي `https://api.lahza.io` بيخدم التجريبي والحقيقي (الفرق بالمفتاح).
3. لو لوحة Lahza فيها قائمة **Callback / Allowed URLs**، ضيف رابط موقعك (`https://dentalcloud.pages.dev`).
4. **Redeploy** المشروع (Deployments → آخر نشر → Retry/Redeploy) عشان الوظائف تقرأ المفتاح الجديد.
5. اعمل **عملية دفع حقيقية صغيرة** وتأكّد إنه رجّعك للموقع وفعّل الخطة (`paid=true` بجدول `clinics` بـ Supabase).

> 🔒 المفتاح `sk_live_…` **سرّي** — بس بإعدادات Cloudflare، أبداً مش بالكود ولا بالواجهة.
> ⚠️ الأسعار بالكود بالدولار (`PRICES` بـ `functions/api/*.js`). لو غيّرت `LAHZA_CURRENCY` لـ ILS/JOD لازم تظبّط الأسعار كمان.
> ℹ️ منطق Lahza: `POST /transaction/initialize` لبدء الدفع (بيرجّع `authorization_url`)، و`GET /transaction/verify/:reference` للتأكد (`data.status === "success"`).

---
**كيف بيشتغل:** الواجهة بتنادي `/api/create-payment` و `/api/verify-payment`، وهنّي
موجودين بمجلد `functions/api/` — Cloudflare بشغّلهم تلقائياً كـ Functions على نفس الرابط.
