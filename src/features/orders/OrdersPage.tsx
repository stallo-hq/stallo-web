import {
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
} from '@ionic/react'
import { receiptOutline } from 'ionicons/icons'
import { useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { useSeller } from '../../hooks/useSeller'
import { formatShortDateTime } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { formatCedis } from '../../lib/money'
import { formatGhanaPhone } from '../../lib/phone'
import { FILTERS, ORDER_STATUS, type OrderFilter } from './orderStatus'
import { useOrders } from './useOrders'

export function OrdersPage() {
  const [filter, setFilter] = useState<OrderFilter>('active')
  const orders = useOrders(filter)
  const seller = useSeller()
  const current = FILTERS.find((f) => f.value === filter)!

  return (
    <LargeTitlePage title="Orders" subtitle="Orders from WhatsApp, newest first.">
      <div className="toolbar-gap">
        <IonSegment
          value={filter}
          onIonChange={(e) => {
            setFilter(e.detail.value as OrderFilter)
            haptic('light')
          }}
        >
          {FILTERS.map((f) => (
            <IonSegmentButton key={f.value} value={f.value}>
              <IonLabel>{f.label}</IonLabel>
            </IonSegmentButton>
          ))}
        </IonSegment>
      </div>

      {orders === undefined ? (
        <div className="centered ion-padding">
          <IonSpinner aria-label="Loading" />
        </div>
      ) : orders.length === 0 ? (
        seller && !seller.whatsappConnected ? (
          <EmptyState
            icon={receiptOutline}
            title={current.emptyTitle}
            message="Connect your WhatsApp number so customers can start ordering."
            actionLabel="Connect WhatsApp"
            actionHref="/settings/whatsapp"
          />
        ) : (
          <EmptyState icon={receiptOutline} title={current.emptyTitle} message={current.emptyMessage} />
        )
      ) : (
        <IonList inset>
          {orders.map((o) => {
            const status = ORDER_STATUS[o.status]
            return (
              <IonItem key={o._id}>
                <IonLabel>
                  <h2 className="truncate">{o.customerName ?? formatGhanaPhone(o.customerPhone)}</h2>
                  <p className="truncate">{o.itemsSummary}</p>
                  <IonText color={status.color}>
                    <p>
                      {status.label} · {formatShortDateTime(o.createdAt)}
                    </p>
                  </IonText>
                </IonLabel>
                <IonText slot="end" className="amount text-headline">
                  {formatCedis(o.totalPesewas)}
                </IonText>
              </IonItem>
            )
          })}
        </IonList>
      )}
    </LargeTitlePage>
  )
}
