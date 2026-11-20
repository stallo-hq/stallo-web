import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import { Badge } from '../../components/ui/Badge'
import { formatShortDateTime } from '../../lib/dates'
import { formatCedis } from '../../lib/money'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './OrderTable.module.css'
import { ORDER_STATUS } from './orderStatus'

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
      </div>
      {orders.map((o) => {
        const status = ORDER_STATUS[o.status]
        return (
          <div key={o._id} className={styles.row} role="row">
            <div role="cell" className={styles.customer}>
              <strong>{o.customerName ?? formatGhanaPhone(o.customerPhone)}</strong>
              <span>{formatShortDateTime(o.createdAt)}</span>
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
          </div>
        )
      })}
    </div>
  )
}
