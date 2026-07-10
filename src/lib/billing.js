// Bank details shown when a clinic chooses to pay its DentalCloud subscription
// by manual bank transfer (instead of PayPal).
//
// Fill these with your real account before going live. This is the account
// that receives subscription payments, i.e. YOUR account, not the clinic's.
export const DENTALCLOUD_BANK = {
  iban: 'PS94AISB070221010107194614001',         // USD account, verified (mod-97 valid)
  ibanIls: 'PS65AISB070321010107194614000',      // ILS / shekel account
  bankName: 'Arab Islamic Bank · البنك الإسلامي العربي',
  accountHolder: 'MOHAMMAD QAREEB',              // exact name on the account
  swift: '',                                     // optional, likely AISBPS22 (confirm with your bank)
}

// Where clinics send their transfer receipt so you can activate their plan.
export const SUPPORT_EMAIL = 'dentalcloudd@gmail.com'

// WhatsApp number shown on the payment screens for clinics that hit a problem.
export const SUPPORT_WHATSAPP = '+972599510078'
