import { IonItem, IonLabel, IonList, IonNote } from '@ionic/react'
import { sunnyOutline } from 'ionicons/icons'
import { EmptyState } from '../../components/EmptyState'
import { SectionHeader } from '../../components/SectionHeader'
import { LargeTitlePage } from '../../components/LargeTitlePage'

// M1: layout only. Needs attention, today's orders and totals arrive in M4–M7.
export function TodayPage() {
  return (
    <LargeTitlePage title="Today">
      <SectionHeader>Summary</SectionHeader>
      <IonList inset>
        <IonItem>
          <IonLabel>Orders</IonLabel>
          <IonNote slot="end">0</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Paid</IonLabel>
          <IonNote slot="end">GH₵ 0.00</IonNote>
        </IonItem>
      </IonList>
      <EmptyState
        icon={sunnyOutline}
        title="Nothing needs attention"
        message="Orders that need you will show up here."
      />
    </LargeTitlePage>
  )
}
