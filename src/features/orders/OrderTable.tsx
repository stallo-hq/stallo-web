import type { FunctionReturnType } from 'convex/server'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { api } from '../../../convex/_generated/api'
import { Badge } from '../../components/ui/Badge'
import { formatShortDateTime } from '../../lib/dates'
import { formatCedis } from '../../lib/money'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './OrderTable.module.css'
import { orderStatusLabel } from './orderStatus'

export type OrderRow = FunctionReturnType<typeof api.orders.list>[number]

/** Orders as a table on wide screens and a stacked list on phones. */
export function OrderTable({ orders }: { orders: OrderRow[] }) {
  return (
    <div className={styles.table} role="table" aria-label="Orders">
      <div className={styles.head} role="row">
        <span role="columnheader">Customer</span>
        <span role="columnheader">Items</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className={styles.right}>
          Total
        </span>
        <span role="columnheader" className="visually-hidden">
          Open
        </span>
      </div>
      {orders.map((o) => {
        const status = orderStatusLabel(o.status, o.paymentMethod)
        return (
          <Link key={o._id} to={`/app/orders/${o._id}`} className={styles.row} role="row" aria-label={`Order ${o.label}`}>
            <div role="cell" className={styles.customer}>
              <strong>{o.customerName ?? formatGhanaPhone(o.customerPhone)}</strong>
              <span className={styles.meta}>
                <code className={styles.orderCode}>{o.label}</code>
                <span>{formatShortDateTime(o.createdAt)}</span>
              </span>
            </div>
            <div role="cell" className={styles.items}>
              {o.itemsSummary}
            </div>
            <div role="cell">
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <div role="cell" className={`${styles.right} num`}>
              {formatCedis(o.totalPesewas)}
            </div>
            <div role="cell" className={styles.chevron} aria-hidden="true">
              <ChevronRight size={16} />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
