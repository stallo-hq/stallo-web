import { MessageCircle, Search, ShoppingBag, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Segmented } from '../../components/ui/Segmented'
import { PageSpinner } from '../../components/ui/Spinner'
import { useSeller } from '../../hooks/useSeller'
import { OrderTable } from './OrderTable'
import styles from './OrdersPage.module.css'
import { FILTERS, type OrderFilter } from './orderStatus'
import { useOrders } from './useOrders'

export function OrdersPage() {
  const [filter, setFilter] = useState<OrderFilter>('active')
  const [search, setSearch] = useState('')
  const orders = useOrders(filter)
  const seller = useSeller()
  const config = FILTERS.find((f) => f.value === filter)!
  const waitingForWhatsApp = seller && !seller.whatsappConnected

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || !orders) return orders
    return orders.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.customerName?.toLowerCase().includes(q) ?? false) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.itemsSummary.toLowerCase().includes(q),
    )
  }, [orders, search])

  return (
    <>
      <PageHeader eyebrow="Sales" title="Orders" description="Track each order from the first message through delivery." />
      <div className={styles.toolbar}>
        <Segmented
          label="Show orders"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        />
        <div className={styles.toolbarRight}>
          <label className={styles.search}>
            <Search size={16} />
            <input
              type="search"
              placeholder="Search customer, #order or item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search orders"
            />
            {search && (
              <button type="button" className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
          {visible !== undefined && (
            <span className={styles.resultCount}>
              {visible.length} {visible.length === 1 ? 'order' : 'orders'}
            </span>
          )}
        </div>
      </div>
      <Card flush>
        {visible === undefined ? (
          <PageSpinner />
        ) : visible.length === 0 ? (
          search.trim() ? (
            <EmptyState
              icon={Search}
              title={`No orders match “${search.trim()}”`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            >
              Try searching by customer name, phone number, order code, or item.
            </EmptyState>
          ) : (
            <EmptyState
              icon={waitingForWhatsApp ? MessageCircle : ShoppingBag}
              title={config.emptyTitle}
              action={
                waitingForWhatsApp ? (
                  <ButtonLink to="/app/settings/whatsapp" variant="primary">
                    Connect WhatsApp
                  </ButtonLink>
                ) : undefined
              }
            >
              {waitingForWhatsApp
                ? 'Orders arrive once your WhatsApp number is connected. It only takes a few minutes.'
                : config.emptyMessage}
            </EmptyState>
          )
        ) : (
          <OrderTable orders={visible} />
        )}
      </Card>
    </>
  )
}
