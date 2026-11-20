import { IonButton, IonButtons, IonIcon } from '@ionic/react'
import { add, cubeOutline } from 'ionicons/icons'
import { EmptyState } from '../../components/EmptyState'
import { LargeTitlePage } from '../../components/LargeTitlePage'

// M1: layout only. Adding and editing products arrives in M2.
export function ProductsPage() {
  return (
    <LargeTitlePage
      title="Products"
      toolbarEnd={
        <IonButtons slot="end">
          <IonButton aria-label="Add product" disabled>
            <IonIcon slot="icon-only" icon={add} />
          </IonButton>
        </IonButtons>
      }
    >
      <EmptyState
        icon={cubeOutline}
        title="No products yet"
        message="Add what you sell so Stallo can price orders correctly."
      />
    </LargeTitlePage>
  )
}
