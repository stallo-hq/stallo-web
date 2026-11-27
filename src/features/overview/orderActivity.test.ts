import { describe, expect, it } from 'vitest'
import { buildOrderActivity, type ActivityOrder } from './orderActivity'

const DAY_MS = 24 * 60 * 60 * 1000

describe('buildOrderActivity', () => {
  it('groups placed orders by day and excludes drafts and orders outside the range', () => {
    const today = Date.UTC(2026, 10, 26)
    const orders: ActivityOrder[] = [
      { createdAt: today + 60_000, status: 'delivered', totalPesewas: 6500 },
      { createdAt: today - DAY_MS + 60_000, status: 'awaiting_payment', totalPesewas: 2800 },
      { createdAt: today + 120_000, status: 'draft', totalPesewas: 1000 },
      { createdAt: today - 7 * DAY_MS, status: 'delivered', totalPesewas: 9000 },
    ]

    expect(buildOrderActivity(orders, '7d', today + 180_000)).toMatchObject({
      orderCount: 2,
      orderValuePesewas: 9300,
      days: [
        { date: today - 6 * DAY_MS, orderCount: 0, orderValuePesewas: 0 },
        { date: today - 5 * DAY_MS, orderCount: 0, orderValuePesewas: 0 },
        { date: today - 4 * DAY_MS, orderCount: 0, orderValuePesewas: 0 },
        { date: today - 3 * DAY_MS, orderCount: 0, orderValuePesewas: 0 },
        { date: today - 2 * DAY_MS, orderCount: 0, orderValuePesewas: 0 },
        { date: today - DAY_MS, orderCount: 1, orderValuePesewas: 2800 },
        { date: today, orderCount: 1, orderValuePesewas: 6500 },
      ],
      partial: false,
    })
  })

  it('marks a range partial only when the 200-order feed reaches into it', () => {
    const today = Date.UTC(2026, 10, 26)
    const recent = Array.from({ length: 200 }, (_, index) => ({
      createdAt: today - index * 60_000,
      status: 'paid',
      totalPesewas: 100,
    }))
    const olderThanRange = recent.map((order) => ({ ...order, createdAt: today - 40 * DAY_MS }))

    expect(buildOrderActivity(recent, '30d', today).partial).toBe(true)
    expect(buildOrderActivity(olderThanRange, '30d', today).partial).toBe(false)
  })
})
