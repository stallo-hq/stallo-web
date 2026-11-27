export type ActivityRange = '7d' | '30d'

export type ActivityOrder = {
  createdAt: number
  status: string
  totalPesewas: number
}

export type ActivityDay = {
  date: number
  orderCount: number
  orderValuePesewas: number
}

export type OrderActivity = {
  days: ActivityDay[]
  orderCount: number
  orderValuePesewas: number
  partial: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
const ORDER_HISTORY_LIMIT = 200

/** Group the latest orders by Ghana's UTC day; drafts aren't customer orders yet. */
export function buildOrderActivity(orders: readonly ActivityOrder[], range: ActivityRange, now = Date.now()): OrderActivity {
  const dayCount = range === '7d' ? 7 : 30
  const currentDate = new Date(now)
  const today = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate())
  const from = today - (dayCount - 1) * DAY_MS
  const days = Array.from({ length: dayCount }, (_, index) => ({
    date: from + index * DAY_MS,
    orderCount: 0,
    orderValuePesewas: 0,
  }))

  for (const order of orders) {
    if (order.status === 'draft' || order.status === 'awaiting_confirmation') continue
    const index = Math.floor((order.createdAt - from) / DAY_MS)
    const day = days[index]
    if (day === undefined) continue
    day.orderCount++
    day.orderValuePesewas += order.totalPesewas
  }

  const earliest = orders[orders.length - 1]
  return {
    days,
    orderCount: days.reduce((total, day) => total + day.orderCount, 0),
    orderValuePesewas: days.reduce((total, day) => total + day.orderValuePesewas, 0),
    partial: orders.length >= ORDER_HISTORY_LIMIT && earliest !== undefined && earliest.createdAt >= from,
  }
}
