import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Segmented } from '../../components/ui/Segmented'
import { PageSpinner } from '../../components/ui/Spinner'
import { useSeller } from '../../hooks/useSeller'
import { OrderTable } from './OrderTable'
import { FILTERS, type OrderFilter } from './orderStatus'
import { useOrders } from './useOrders'

export function OrdersPage() {
  const [filter, setFilter] = useState<OrderFilter>('active')
  const orders = useOrders(filter)
  const seller = useSeller()
  const config = FILTERS.find((f) => f.value === filter)!
  const waitingForWhatsApp = seller && !seller.whatsappConnected

  return (
    <>
      <PageHeader title="Orders" description="Every order from WhatsApp, from first message to delivery." />
      <div style={{ marginBottom: 16 }}>
        <Segmented
          label="Show orders"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        />
      </div>
      <Card flush>
        {orders === undefined ? (
          <PageSpinner />
        ) : orders.length === 0 ? (
          <EmptyState
            title={config.emptyTitle}
            action={
              waitingForWhatsApp ? (
                <ButtonLink to="/app/settings/whatsapp" variant="dark">
                  Connect WhatsApp
                </ButtonLink>
              ) : undefined
            }
          >
            {waitingForWhatsApp
              ? 'Orders arrive once your WhatsApp number is connected. It only takes a few minutes.'
              : config.emptyMessage}
          </EmptyState>
        ) : (
          <OrderTable orders={orders} />
        )}
      </Card>
    </>
  )
}
