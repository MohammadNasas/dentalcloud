import test from 'node:test'
import assert from 'node:assert/strict'
import { instructionRecipientPhone } from '../src/lib/instructionRecipient.js'
import { buildInstructionWhatsAppMessage, waLinkForDevice } from '../src/lib/utils.js'

test('instruction recipients require a saved international number without guessing a country', () => {
  for (const value of [undefined, '', '  ']) assert.equal(instructionRecipientPhone(value).status, 'missing')
  for (const value of ['0599123456', '123', '+970599123456 ext 12', 'not a phone']) {
    assert.equal(instructionRecipientPhone(value).status, 'invalid')
  }
  for (const value of ['+970 599-123456', '00970599123456', '970599123456', '\u200f+٩٧٠ ٥٩٩١٢٣٤٥٦']) {
    assert.deepEqual(instructionRecipientPhone(value), { status: 'ready', number: '970599123456' })
  }
  assert.equal(instructionRecipientPhone('+962791234567').number, '962791234567')
})

test('instruction message preserves the selected sheet and recipient on every WhatsApp route', () => {
  const message = buildInstructionWhatsAppMessage({
    clinicName: 'عيادة تجريبية', patientName: 'مريض تجريبي',
    title: 'تعليمات خاصة & متابعة', points: ['البند الأول', '   ', 'البند الثاني؟'],
  })
  assert.ok(message.includes('المريض: مريض تجريبي'))
  assert.ok(message.includes('*تعليمات خاصة & متابعة*'))
  assert.ok(message.includes('• البند الأول\n• البند الثاني؟'))
  for (const device of ['web', 'mobile', 'app']) {
    const url = new URL(waLinkForDevice('970599123456', message, device))
    assert.equal(url.searchParams.get('text'), message)
    assert.equal(device === 'mobile' ? url.pathname.slice(1) : url.searchParams.get('phone'), '970599123456')
  }
})
