// Provider/database diagnostics belong in logs, not on a doctor's checkout.
export function paymentErrorMessage(result, lang = 'ar') {
  const ar = lang === 'ar'
  switch (result?.error) {
    case 'unauthorized':
      return ar ? 'انتهت جلسة الدخول. سجّل الدخول مرة ثانية وحاول.' : 'Your session expired. Sign in again and retry.'
    case 'trial_already_used':
      return ar ? 'تم استخدام التجربة المجانية لهذا الحساب. يمكنك المتابعة بالاشتراك المدفوع.' : 'This account has already used its free trial. You can continue with a paid subscription.'
    case 'already_paid':
      return ar ? 'اشتراكك الحالي ما زال ساريًا؛ لا تحتاج لدفعة أخرى الآن.' : 'Your current subscription is still valid; no additional payment is needed now.'
    case 'subscription_still_active':
      return ar ? 'لديك اشتراك قائم على PayPal. ألغِ تجديده من PayPal قبل بدء اشتراك آخر لتجنب تكرار الخصم.' : 'You already have a PayPal subscription. Cancel its renewal in PayPal before starting another to avoid duplicate charges.'
    case 'pending_other_plan':
      return ar ? 'لديك طلب تفعيل غير مكتمل لباقة أخرى. اختر الباقة السابقة لإكماله، أو تواصل معنا لإلغائه.' : 'You have an unfinished checkout for another plan. Select that plan to resume, or contact us to cancel it.'
    case 'checkout_in_progress':
      return ar ? 'طلب الاشتراك السابق لسه قيد التجهيز. انتظر شوي وأعد المحاولة.' : 'Your previous checkout is still being prepared. Wait a moment and retry.'
    case 'not_configured':
    case 'supabase_not_configured':
      return ar ? 'الدفع غير متاح مؤقتاً. تواصل معنا للمساعدة.' : 'Payments are temporarily unavailable. Contact us for help.'
    default:
      return ar ? 'تعذّر إكمال طلب الاشتراك. أعد المحاولة، وإذا استمرت المشكلة تواصل معنا.' : 'We could not complete the subscription request. Retry, or contact us if the problem continues.'
  }
}
