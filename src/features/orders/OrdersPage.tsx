import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react'
import { receiptOutline } from 'ionicons/icons'
import { useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { haptic } from '../../lib/haptics'

type Filter = 'active' | 'delivered' | 'all'

// M1: layout only. The order list and detail arrive in M4–M6.
export function OrdersPage() {
  const [filter, setFilter] = useState<Filter>('active')

  return (
    <LargeTitlePage title="Orders">
      <div className="ion-padding-horizontal">
        <IonSegment
          value={filter}
          onIonChange={(e) => {
            setFilter(e.detail.value as Filter)
            haptic('light')
          }}
        >
          <IonSegmentButton value="active">
            <IonLabel>Active</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="delivered">
            <IonLabel>Delivered</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="all">
            <IonLabel>All</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>
      <EmptyState
        icon={receiptOutline}
        title="No orders yet"
        message="When customers order on WhatsApp, their orders appear here."
      />
    </LargeTitlePage>
  )
}
