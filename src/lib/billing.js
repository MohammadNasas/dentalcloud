// Bank details shown when a clinic chooses to pay its DentalCloud subscription
// by manual bank transfer (instead of PayPal).
//
// âš ï¸ FILL THESE WITH YOUR REAL ACCOUNT before going live. This is the account
// that receives subscription payments â€” i.e. YOUR account, not the clinic's.
export const DENTALCLOUD_BANK = {
  iban: 'PS94AISB070221010107194614001',         // verified (mod-97 valid)
  bankName: 'Arab Islamic Bank Â· Ø§Ù„Ø¨Ù†Ùƒ Ø§Ù„Ø¥Ø³Ù„Ø§Ù…ÙŠ Ø§Ù„Ø¹Ø±Ø¨ÙŠ',
  accountHolder: 'MOHAMMAD QAREEB',              // exact name on the account
  swift: '',                                     // â† optional, likely AISBPS22 (confirm with your bank)
}

// Where clinics send their transfer receipt so you can activate their plan.
export const SUPPORT_EMAIL = 'dentalcloudd@gmail.com'

// WhatsApp number shown on the payment screens for clinics that hit a problem.
export const SUPPORT_WHATSAPP = '+972599510078'
