import { describe, expect, it } from 'vitest'
import { formatLongDate, formatShortDateTime, greeting } from './dates'
import { formatCedis, parseCedis, pesewasToInput } from './money'
import { formatGhanaPhone, toE164Ghana } from './phone'

describe('money', () => {
  it('formats pesewas as cedis', () => {
    expect(formatCedis(125050)).toBe('GH₵ 1,250.50')
    expect(formatCedis(0)).toBe('GH₵ 0.00')
    expect(formatCedis(5)).toBe('GH₵ 0.05')
  })

  it('parses what sellers type', () => {
    expect(parseCedis('15.5')).toBe(1550)
    expect(parseCedis('15.50')).toBe(1550)
    expect(parseCedis('1,250')).toBe(125000)
    expect(parseCedis('GH₵ 20')).toBe(2000)
    expect(parseCedis(' 0.05 ')).toBe(5)
  })

  it('rejects amounts that are not valid prices', () => {
    for (const bad of ['', 'abc', '0', '0.00', '-5', '1.234', '1.2.3', '1e3']) {
      expect(parseCedis(bad), bad).toBeNull()
    }
  })

  it('round-trips through the input format', () => {
    expect(parseCedis(pesewasToInput(6500))).toBe(6500)
    expect(pesewasToInput(1550)).toBe('15.50')
  })
})

describe('phone', () => {
  it('accepts the usual ways of writing a Ghana mobile number', () => {
    for (const input of ['024 123 4567', '0241234567', '+233 24 123 4567', '233241234567', '024-123-4567']) {
      expect(toE164Ghana(input), input).toBe('+233241234567')
    }
  })

  it('rejects numbers that are not Ghana mobiles', () => {
    for (const bad of ['', '12345', '0301234567', '+44 7700 900123', '02412345678']) {
      expect(toE164Ghana(bad), bad).toBeNull()
    }
  })

  it('formats E.164 for display', () => {
    expect(formatGhanaPhone('+233241234567')).toBe('024 123 4567')
    expect(formatGhanaPhone('+447700900123')).toBe('+447700900123')
  })
})

describe('dates (Africa/Accra)', () => {
  const morning = new Date('2026-11-20T08:00:00Z')
  const evening = new Date('2026-11-20T19:30:00Z')

  it('greets by Ghana time of day', () => {
    expect(greeting(morning)).toBe('Good morning')
    expect(greeting(new Date('2026-11-20T13:00:00Z'))).toBe('Good afternoon')
    expect(greeting(evening)).toBe('Good evening')
  })

  it('formats dates', () => {
    expect(formatLongDate(morning)).toBe('Friday 20 November')
    expect(formatShortDateTime(evening.getTime(), evening.getTime())).toBe('19:30')
    expect(formatShortDateTime(morning.getTime(), new Date('2026-11-21T09:00:00Z').getTime())).toBe(
      '20 Nov, 08:00',
    )
  })
})
