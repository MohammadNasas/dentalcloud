// Provider/database diagnostics belong in logs, not on a doctor's checkout.
export function paymentErrorMessage(result, lang = 'ar') {
  const ar = lang === 'ar'
  switch (result?.error) {
    case 'unauthorized':
      return ar ? 'انتهت جلسة الدخول. سجّل الدخول مرة ثانية وحاول.' : 'Your session expired. Sign in again and retry.'
    case 'trial_already_used':
      return ar ? 'تم استخدام التجربة المجانية لهذا الحساب. يمكنك المتابعة بالاشتراك السنوي.' : 'This account has already used its free trial. You can continue with the annual subscription.'
    case 'checkout_in_progress':
      return ar ? 'طلب الاشتراك السابق لسه قيد التجهيز. انتظر شوي وأعد المحاولة.' : 'Your previous checkout is still being prepared. Wait a moment and retry.'
    case 'not_configured':
    case 'supabase_not_configured':
      return ar ? 'الدفع غير متاح مؤقتاً. تواصل معنا للمساعدة.' : 'Payments are temporarily unavailable. Contact us for help.'
    default:
      return ar ? 'تعذّر إكمال طلب الاشتراك. أعد المحاولة، وإذا استمرت المشكلة تواصل معنا.' : 'We could not complete the subscription request. Retry, or contact us if the problem continues.'
  }
}
