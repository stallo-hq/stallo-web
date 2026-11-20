import {
  IonAlert,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { cashOutline, logoWhatsapp } from 'ionicons/icons'
import { api } from '../../../convex/_generated/api'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { SectionHeader } from '../../components/SectionHeader'
import { haptic } from '../../lib/haptics'
import { formatGhanaPhone } from '../../lib/phone'

export function SettingsPage() {
  const seller = useQuery(api.sellers.mine)
  const { signOut } = useAuthActions()

  return (
    <LargeTitlePage title="Settings">
      <SectionHeader>Business</SectionHeader>
      <IonList inset>
        <IonItem>
          <IonLabel>Name</IonLabel>
          <IonNote slot="end">{seller?.businessName ?? ''}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Phone</IonLabel>
          <IonNote slot="end">{seller ? formatGhanaPhone(seller.phone) : ''}</IonNote>
        </IonItem>
      </IonList>

      <SectionHeader>Connections</SectionHeader>
      <IonList inset>
        <IonItem detail={false}>
          <IonIcon slot="start" icon={logoWhatsapp} aria-hidden="true" color="medium" />
          <IonLabel>WhatsApp</IonLabel>
          <IonNote slot="end">{seller?.whatsappConnected ? 'Connected' : 'Not connected'}</IonNote>
        </IonItem>
        <IonItem detail={false}>
          <IonIcon slot="start" icon={cashOutline} aria-hidden="true" color="medium" />
          <IonLabel>Payouts</IonLabel>
          <IonNote slot="end">{seller?.payoutsConnected ? 'Connected' : 'Not set up'}</IonNote>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonItem button detail={false} id="sign-out">
          <IonLabel color="danger">Sign out</IonLabel>
        </IonItem>
      </IonList>

      <IonAlert
        trigger="sign-out"
        header="Sign out?"
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Sign out',
            role: 'destructive',
            handler: () => {
              haptic('light')
              void signOut()
            },
          },
        ]}
      />
    </LargeTitlePage>
  )
}
