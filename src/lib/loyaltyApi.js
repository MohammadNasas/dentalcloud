import { supabase } from './supabaseClient'
export async function loyaltyRpc(name, params) {
 if (!supabase) throw new Error('setup_required')
 const { data, error } = await supabase.rpc(name, params)
 if (error) throw new Error(error.code === '42501' ? 'forbidden' : 'loyalty_failed')
 return data
}
export function loyaltyError(error, lang) {
 const errors = {
  forbidden: ['ليس لديك صلاحية لتنفيذ هذا الإجراء.', 'You do not have access to this action.'],
  loyalty_failed: ['تعذّر حفظ العملية. للمكافأة اختر زيارة مكتملة بعد زيارات الاستحقاق، ثم أعد المحاولة.', 'Could not save. For redemption, choose a completed visit after the qualifying visits, then retry.'],
 }
 return (errors[error?.message] || ['تعذّر تحميل بطاقة الولاء. تحقق من الاتصال وأعد المحاولة.', 'Could not load loyalty. Check your connection and retry.'])[lang === 'ar' ? 0 : 1]
}
