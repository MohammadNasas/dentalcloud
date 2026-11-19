import test from 'node:test'
import assert from 'node:assert/strict'
import { loyaltyLink, loyaltyWhatsAppMessage } from '../src/lib/loyalty.js'
import { waLinkForDevice } from '../src/lib/utils.js'
import { instructionRecipientPhone } from '../src/lib/instructionRecipient.js'

test('loyalty sharing preserves the full private fragment and message across WhatsApp clients', () => {
  const recipient = instructionRecipientPhone('٠٠٩٧٠ ٥٩٩١٢٣٤٥٦')
  assert.equal(recipient.status, 'ready')
  for (const token of ['a'.repeat(64), 'b'.repeat(64)]) {
    const cardUrl = loyaltyLink(token)
    for (const lang of ['ar', 'en']) {
      const message = loyaltyWhatsAppMessage({lang, patientName:'Test & مريض', clinicName:'Clinic', url:cardUrl})
      assert.ok(message.includes(cardUrl))
      for (const device of ['web','mobile','app']) {
        const link = new URL(waLinkForDevice(recipient.number,message,device))
        assert.equal(link.searchParams.get('text'),message)
        assert.equal(link.hash,'')
        assert.equal(device === 'mobile' ? link.pathname.slice(1) : link.searchParams.get('phone'),recipient.number)
      }
    }
  }
  assert.equal(loyaltyWhatsAppMessage({url:''}),'')
  assert.equal(instructionRecipientPhone('').status,'missing')
  assert.equal(instructionRecipientPhone('0599123456').status,'invalid')
})
