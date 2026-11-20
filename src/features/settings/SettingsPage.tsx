import { IonAlert, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { cashOutline, logoWhatsapp, storefrontOutline } from 'ionicons/icons'
import { useState } from 'react'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { SectionFooter } from '../../components/SectionFooter'
import { SectionHeader } from '../../components/SectionHeader'
import { useSeller } from '../../hooks/useSeller'
import { haptic } from '../../lib/haptics'
import { formatGhanaPhone } from '../../lib/phone'
import { BusinessNameForm } from './BusinessNameForm'
import { connectionStatus } from './connectionStatus'
import { useSettingsActions } from './useSettings'

export function SettingsPage() {
  const seller = useSeller()
  const { signOut } = useAuthActions()
  const { updateBusinessName } = useSettingsActions()
  const [editingName, setEditingName] = useState(false)

  if (!seller) return null

  const whatsapp = connectionStatus(seller.whatsappConnected, seller.whatsappSetupRequestedAt)
  const payouts = connectionStatus(seller.payoutsConnected, seller.payoutsSetupRequestedAt)

  return (
    <LargeTitlePage title="Settings">
      <SectionHeader>Business</SectionHeader>
      <IonList inset>
        <IonItem button detail onClick={() => setEditingName(true)}>
          <IonIcon slot="start" icon={storefrontOutline} color="medium" aria-hidden="true" />
          <IonLabel>Name</IonLabel>
          <IonNote slot="end">{seller.businessName}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Phone</IonLabel>
          <IonNote slot="end">{formatGhanaPhone(seller.phone)}</IonNote>
        </IonItem>
      </IonList>
      <SectionFooter>You sign in with this phone number.</SectionFooter>

      <SectionHeader>Connections</SectionHeader>
      <IonList inset>
        <IonItem routerLink="/settings/whatsapp" detail>
          <IonIcon slot="start" icon={logoWhatsapp} color="medium" aria-hidden="true" />
          <IonLabel>WhatsApp</IonLabel>
          <IonNote slot="end" color={whatsapp.color}>
            {whatsapp.label}
          </IonNote>
        </IonItem>
        <IonItem routerLink="/settings/payouts" detail>
          <IonIcon slot="start" icon={cashOutline} color="medium" aria-hidden="true" />
          <IonLabel>Payouts</IonLabel>
          <IonNote slot="end" color={payouts.color}>
            {payouts.label}
          </IonNote>
        </IonItem>
      </IonList>

      <IonList inset className="ion-margin-top">
        <IonItem button detail={false} id="sign-out">
          <IonLabel color="danger">Sign out</IonLabel>
        </IonItem>
      </IonList>

      <IonAlert
        trigger="sign-out"
        header="Sign out?"
        message="You can sign back in any time with your phone number and password."
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

      <BusinessNameForm
        isOpen={editingName}
        current={seller.businessName}
        onSave={(businessName) => updateBusinessName({ businessName })}
        onClose={() => setEditingName(false)}
      />
    </LargeTitlePage>
  )
}
