import type { Doc } from '../_generated/dataModel'
import { startOfTodayAccra } from './time'

export type TrackerRange = '7d' | '30d' | '90d'

const DAY_MS = 24 * 60 * 60 * 1000
export const TRACKER_QUERY_LIMIT = 5000

export type TrackerOrderInput = Pick<
  Doc<'orders'>,
  'createdAt' | 'status' | 'paymentStatus' | 'paymentMethod' | 'cashStatus' | 'subtotalPesewas' | 'totalPesewas' | 'items'
>

export type TrackerDayPoint = {
  date: number
  orders: number
  paidOrders: number
  deliveredOrders: number
  revenuePesewas: number
  grossPesewas: number
  prevOrders: number
  prevDeliveredOrders: number
  prevRevenuePesewas: number
}

export type TrackerPipelineStage = {
  count: number
  pesewas: number
}

export type TrackerAnalytics = {
  range: TrackerRange
  days: number
  series: TrackerDayPoint[]
  totals: {
    orders: number
    paidOrders: number
    deliveredOrders: number
    failedOrCancelled: number
    revenuePesewas: number
    grossPesewas: number
    avgOrderPesewas: number
    paymentRatePct: number
    fulfilmentRatePct: number
  }
  previousTotals: {
    orders: number
    paidOrders: number
    deliveredOrders: number
    revenuePesewas: number
    grossPesewas: number
    avgOrderPesewas: number
  }
  deltas: {
    revenuePct: number | null
    ordersPct: number | null
    deliveredPct: number | null
    avgOrderPct: number | null
  }
  pipeline: {
    awaitingPayment: TrackerPipelineStage
    readyToDispatch: TrackerPipelineStage
    inTransit: TrackerPipelineStage
    delivered: TrackerPipelineStage
    issues: TrackerPipelineStage
  }
  paymentMix: {
    onlineOrders: number
    onlinePesewas: number
    cashOrders: number
    cashPesewas: number
  }
  topProducts: {
    name: string
    unitsSold: number
    revenuePesewas: number
  }[]
  partial: boolean
}

export function rangeDays(range: TrackerRange): number {
  if (range === '7d') return 7
  if (range === '90d') return 90
  return 30
}

export function trackerWindowBounds(range: TrackerRange, now: number = Date.now()) {
  const days = rangeDays(range)
  const today = startOfTodayAccra(now)
  const currentFrom = today - (days - 1) * DAY_MS
  const previousFrom = currentFrom - days * DAY_MS
  return { days, today, currentFrom, previousFrom }
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function isCollected(order: TrackerOrderInput): boolean {
  return order.paymentStatus === 'paid' || order.cashStatus === 'received'
}

/**
 * Computes real-time order, revenue, comparison, pipeline, payment-mix and
 * top-product analytics from real Convex order documents.
 */
export function buildTrackerAnalytics(
  orders: readonly TrackerOrderInput[],
  range: TrackerRange,
  now: number = Date.now(),
  partial = false,
): TrackerAnalytics {
  const { days, currentFrom, previousFrom } = trackerWindowBounds(range, now)
  const currentEnd = currentFrom + days * DAY_MS

  const series: TrackerDayPoint[] = Array.from({ length: days }, (_, index) => ({
    date: currentFrom + index * DAY_MS,
    orders: 0,
    paidOrders: 0,
    deliveredOrders: 0,
    revenuePesewas: 0,
    grossPesewas: 0,
    prevOrders: 0,
    prevDeliveredOrders: 0,
    prevRevenuePesewas: 0,
  }))

  let ordersCount = 0
  let paidOrders = 0
  let deliveredOrders = 0
  let failedOrCancelled = 0
  let revenuePesewas = 0
  let grossPesewas = 0

  let prevOrders = 0
  let prevPaidOrders = 0
  let prevDeliveredOrders = 0
  let prevRevenuePesewas = 0
  let prevGrossPesewas = 0

  const pipeline = {
    awaitingPayment: { count: 0, pesewas: 0 },
    readyToDispatch: { count: 0, pesewas: 0 },
    inTransit: { count: 0, pesewas: 0 },
    delivered: { count: 0, pesewas: 0 },
    issues: { count: 0, pesewas: 0 },
  }

  const paymentMix = {
    onlineOrders: 0,
    onlinePesewas: 0,
    cashOrders: 0,
    cashPesewas: 0,
  }

  const productTotals = new Map<string, { name: string; unitsSold: number; revenuePesewas: number }>()

  for (const order of orders) {
    if (order.status === 'draft' || order.status === 'awaiting_confirmation') continue
    if (order.createdAt < previousFrom || order.createdAt >= currentEnd) continue

    const collected = isCollected(order)
    const collectedAmount = collected ? order.subtotalPesewas : 0

    if (order.createdAt >= currentFrom) {
      const dayIndex = Math.floor((order.createdAt - currentFrom) / DAY_MS)
      const day = series[dayIndex]
      if (day !== undefined) {
        day.orders++
        day.grossPesewas += order.totalPesewas
        if (collected) {
          day.paidOrders++
          day.revenuePesewas += collectedAmount
        }
        if (order.status === 'delivered') {
          day.deliveredOrders++
        }
      }

      ordersCount++
      grossPesewas += order.totalPesewas
      if (collected) {
        paidOrders++
        revenuePesewas += collectedAmount
      }
      if (order.status === 'delivered') {
        deliveredOrders++
      }
      if (order.status === 'cancelled' || order.status === 'delivery_failed' || order.status === 'returned') {
        failedOrCancelled++
      }

      if (order.status === 'awaiting_payment') {
        pipeline.awaitingPayment.count++
        pipeline.awaitingPayment.pesewas += order.totalPesewas
      } else if (order.status === 'paid') {
        pipeline.readyToDispatch.count++
        pipeline.readyToDispatch.pesewas += order.totalPesewas
      } else if (order.status === 'dispatched') {
        pipeline.inTransit.count++
        pipeline.inTransit.pesewas += order.totalPesewas
      } else if (order.status === 'delivered') {
        pipeline.delivered.count++
        pipeline.delivered.pesewas += order.totalPesewas
      } else {
        pipeline.issues.count++
        pipeline.issues.pesewas += order.totalPesewas
      }

      if (order.paymentMethod === 'cash') {
        paymentMix.cashOrders++
        paymentMix.cashPesewas += order.totalPesewas
      } else if (order.paymentMethod === 'online' || order.paymentStatus === 'paid') {
        paymentMix.onlineOrders++
        paymentMix.onlinePesewas += order.totalPesewas
      }

      if (order.status !== 'cancelled' && order.status !== 'returned') {
        for (const item of order.items) {
          const key = item.name.trim().toLowerCase()
          const existing = productTotals.get(key)
          const itemRevenue = item.unitPricePesewas * item.qty
          if (existing) {
            existing.unitsSold += item.qty
            existing.revenuePesewas += itemRevenue
          } else {
            productTotals.set(key, {
              name: item.name,
              unitsSold: item.qty,
              revenuePesewas: itemRevenue,
            })
          }
        }
      }
    } else {
      const prevDayIndex = Math.floor((order.createdAt - previousFrom) / DAY_MS)
      const day = series[prevDayIndex]
      if (day !== undefined) {
        day.prevOrders++
        if (collected) day.prevRevenuePesewas += collectedAmount
        if (order.status === 'delivered') day.prevDeliveredOrders++
      }

      prevOrders++
      prevGrossPesewas += order.totalPesewas
      if (collected) {
        prevPaidOrders++
        prevRevenuePesewas += collectedAmount
      }
      if (order.status === 'delivered') {
        prevDeliveredOrders++
      }
    }
  }

  const avgOrderPesewas = ordersCount > 0 ? Math.round(grossPesewas / ordersCount) : 0
  const prevAvgOrderPesewas = prevOrders > 0 ? Math.round(prevGrossPesewas / prevOrders) : 0
  const paymentRatePct = ordersCount > 0 ? Math.round((paidOrders / ordersCount) * 1000) / 10 : 0
  const fulfilmentRatePct = ordersCount > 0 ? Math.round((deliveredOrders / ordersCount) * 1000) / 10 : 0

  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.revenuePesewas - a.revenuePesewas || b.unitsSold - a.unitsSold)
    .slice(0, 5)

  return {
    range,
    days,
    series,
    totals: {
      orders: ordersCount,
      paidOrders,
      deliveredOrders,
      failedOrCancelled,
      revenuePesewas,
      grossPesewas,
      avgOrderPesewas,
      paymentRatePct,
      fulfilmentRatePct,
    },
    previousTotals: {
      orders: prevOrders,
      paidOrders: prevPaidOrders,
      deliveredOrders: prevDeliveredOrders,
      revenuePesewas: prevRevenuePesewas,
      grossPesewas: prevGrossPesewas,
      avgOrderPesewas: prevAvgOrderPesewas,
    },
    deltas: {
      revenuePct: pctDelta(revenuePesewas, prevRevenuePesewas),
      ordersPct: pctDelta(ordersCount, prevOrders),
      deliveredPct: pctDelta(deliveredOrders, prevDeliveredOrders),
      avgOrderPct: pctDelta(avgOrderPesewas, prevAvgOrderPesewas),
    },
    pipeline,
    paymentMix,
    topProducts,
    partial,
  }
}
