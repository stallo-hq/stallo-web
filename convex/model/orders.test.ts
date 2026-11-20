import { describe, expect, it } from 'vitest'
import { ORDER_TRANSITIONS, PAYMENT_TRANSITIONS, canChangePayment, canTransition, type OrderStatus, type PaymentStatus } from './orders'

const ALL: OrderStatus[] = [
  'draft',
  'awaiting_confirmation',
  'awaiting_payment',
  'paid',
  'dispatched',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
]

// The order life cycle from CLAUDE.md §5, written out independently of the code.
const ALLOWED = new Set([
  'draft→awaiting_confirmation',
  'draft→cancelled',
  'awaiting_confirmation→draft',
  'awaiting_confirmation→awaiting_payment',
  'awaiting_confirmation→cancelled',
  'awaiting_payment→paid',
  'awaiting_payment→cancelled',
  'paid→dispatched',
  'paid→cancelled',
  'dispatched→delivered',
  'dispatched→delivery_failed',
  'delivery_failed→dispatched',
  'delivery_failed→returned',
])

describe('order transitions', () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const key = `${from}→${to}`
      it(`${ALLOWED.has(key) ? 'allows' : 'rejects'} ${key}`, () => {
        expect(canTransition(from, to)).toBe(ALLOWED.has(key))
      })
    }
  }

  it('never cancels once the order has left with a rider', () => {
    for (const from of ['dispatched', 'delivered', 'delivery_failed', 'returned'] as const) {
      expect(canTransition(from, 'cancelled')).toBe(false)
    }
  })

  it('has no way out of finished orders', () => {
    expect(ORDER_TRANSITIONS.delivered).toEqual([])
    expect(ORDER_TRANSITIONS.returned).toEqual([])
    expect(ORDER_TRANSITIONS.cancelled).toEqual([])
  })
})

describe('payment transitions', () => {
  const PAYMENTS: PaymentStatus[] = ['none', 'pending', 'paid', 'failed', 'refunded']

  it('only refunds what was paid', () => {
    for (const from of PAYMENTS) expect(canChangePayment(from, 'refunded')).toBe(from === 'paid')
  })

  it('records a payment that arrives late', () => {
    expect(canChangePayment('none', 'paid')).toBe(true)
    expect(canChangePayment('failed', 'paid')).toBe(true)
  })

  it('lets a failed refund put the order back to paid', () => {
    expect(PAYMENT_TRANSITIONS.refunded).toEqual(['paid'])
  })
})
