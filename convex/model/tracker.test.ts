import { describe, expect, it } from 'vitest'
import { buildTrackerAnalytics, type TrackerOrderInput } from './tracker'

const DAY_MS = 24 * 60 * 60 * 1000

function makeOrder(overrides: Partial<TrackerOrderInput>): TrackerOrderInput {
  return {
    createdAt: Date.UTC(2026, 10, 26, 10, 0),
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'online',
    subtotalPesewas: 5000,
    totalPesewas: 6000,
    items: [{ productId: 'products:test' as any, name: 'Jollof with chicken', unitPricePesewas: 5000, qty: 1 }],
    ...overrides,
  }
}

describe('buildTrackerAnalytics', () => {
  it('aggregates current and prior windows, deltas, pipeline, payment mix, and top products', () => {
    const now = Date.UTC(2026, 10, 26, 14, 0)
    const today = Date.UTC(2026, 10, 26)

    const orders: TrackerOrderInput[] = [
      // Current 7d window
      makeOrder({
        createdAt: today + 60_000,
        status: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'online',
        subtotalPesewas: 10_000,
        totalPesewas: 11_500,
        items: [{ productId: 'products:test' as any, name: 'Jollof with chicken', unitPricePesewas: 5000, qty: 2 }],
      }),
      makeOrder({
        createdAt: today - 2 * DAY_MS,
        status: 'paid',
        paymentStatus: 'none',
        paymentMethod: 'cash',
        cashStatus: 'received',
        subtotalPesewas: 4000,
        totalPesewas: 4000,
        items: [{ productId: 'products:test' as any, name: 'Kelewele', unitPricePesewas: 2000, qty: 2 }],
      }),
      makeOrder({
        createdAt: today - DAY_MS,
        status: 'awaiting_payment',
        paymentStatus: 'pending',
        paymentMethod: 'online',
        subtotalPesewas: 3000,
        totalPesewas: 3500,
        items: [{ productId: 'products:test' as any, name: 'Waakye special', unitPricePesewas: 3000, qty: 1 }],
      }),
      // Excluded drafts
      makeOrder({
        createdAt: today + 120_000,
        status: 'draft',
        paymentStatus: 'none',
        subtotalPesewas: 9999,
        totalPesewas: 9999,
      }),
      // Previous 7d window (same day offset as today: today - 7d)
      makeOrder({
        createdAt: today - 7 * DAY_MS + 60_000,
        status: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'online',
        subtotalPesewas: 7000,
        totalPesewas: 8000,
      }),
    ]

    const result = buildTrackerAnalytics(orders, '7d', now)

    expect(result.series).toHaveLength(7)
    expect(result.series[6]).toMatchObject({
      date: today,
      orders: 1,
      paidOrders: 1,
      deliveredOrders: 1,
      revenuePesewas: 10_000,
      prevOrders: 1,
      prevDeliveredOrders: 1,
      prevRevenuePesewas: 7000,
    })

    expect(result.totals).toMatchObject({
      orders: 3,
      paidOrders: 2,
      deliveredOrders: 1,
      failedOrCancelled: 0,
      revenuePesewas: 14_000,
      grossPesewas: 19_000,
    })

    // Revenue went from 7,000 -> 14,000 (+100%)
    expect(result.deltas.revenuePct).toBe(100)
    // Orders went from 1 -> 3 (+200%)
    expect(result.deltas.ordersPct).toBe(200)

    expect(result.pipeline.delivered).toEqual({ count: 1, pesewas: 11_500 })
    expect(result.pipeline.readyToDispatch).toEqual({ count: 1, pesewas: 4000 })
    expect(result.pipeline.awaitingPayment).toEqual({ count: 1, pesewas: 3500 })

    expect(result.paymentMix).toEqual({
      onlineOrders: 2,
      onlinePesewas: 15_000,
      cashOrders: 1,
      cashPesewas: 4000,
    })

    expect(result.topProducts[0]).toEqual({
      name: 'Jollof with chicken',
      unitsSold: 2,
      revenuePesewas: 10_000,
    })
  })

  it('returns null deltas when prior window has zero activity', () => {
    const now = Date.UTC(2026, 10, 26, 14, 0)
    const result = buildTrackerAnalytics([makeOrder({ createdAt: now - 60_000 })], '30d', now)
    expect(result.deltas).toEqual({
      revenuePct: null,
      ordersPct: null,
      deliveredPct: null,
      avgOrderPct: null,
    })
  })
})
