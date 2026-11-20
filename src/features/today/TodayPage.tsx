import { IonIcon, IonItem, IonLabel, IonList, IonNote, IonSpinner } from '@ionic/react'
import { checkmarkCircleOutline, warningOutline } from 'ionicons/icons'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { SectionHeader } from '../../components/SectionHeader'
import { formatLongDate, formatShortDateTime, greeting } from '../../lib/dates'
import { HowItWorks } from './HowItWorks'
import { SetupChecklist } from './SetupChecklist'
import { StatTiles } from './StatTiles'
import { useSeller } from '../../hooks/useSeller'
import { useToday } from './useToday'

export function TodayPage() {
  const today = useToday()
  const seller = useSeller()
  const subtitle = seller
    ? `${greeting()}, ${seller.businessName} · ${formatLongDate()}`
    : formatLongDate()

  if (today === undefined || seller === undefined) {
    return (
      <LargeTitlePage title="Today" subtitle={subtitle}>
        <div className="centered ion-padding">
          <IonSpinner aria-label="Loading" />
        </div>
      </LargeTitlePage>
    )
  }
  if (today === null || seller === null) return null

  const { setup, stats, attention, attentionCount } = today
  const setupComplete = setup.hasProducts && setup.whatsappConnected && setup.payoutsConnected
  const hasAnyOrders = stats.ordersToday + stats.awaitingPayment + stats.toDeliver > 0

  return (
    <LargeTitlePage title="Today" subtitle={subtitle}>
      <StatTiles stats={stats} />

      <div className="columns">
        <div>
          <SectionHeader detail={attentionCount > 0 ? String(attentionCount) : undefined}>
            Needs attention
          </SectionHeader>
          <IonList inset>
            {attention.length === 0 ? (
              <IonItem>
                <IonIcon slot="start" icon={checkmarkCircleOutline} color="success" aria-hidden="true" />
                <IonLabel className="ion-text-wrap">
                  <h2>All clear</h2>
                  <p>Orders Stallo can’t handle on its own will appear here.</p>
                </IonLabel>
              </IonItem>
            ) : (
              attention.map((a) => (
                <IonItem key={a._id}>
                  <IonIcon slot="start" icon={warningOutline} color="warning" aria-hidden="true" />
                  <IonLabel className="ion-text-wrap">
                    <h2>{a.summary}</h2>
                  </IonLabel>
                  <IonNote slot="end">{formatShortDateTime(a.createdAt)}</IonNote>
                </IonItem>
              ))
            )}
          </IonList>

          {!setupComplete && (
            <SetupChecklist
              hasProducts={setup.hasProducts}
              whatsappConnected={setup.whatsappConnected}
              payoutsConnected={setup.payoutsConnected}
              whatsappRequested={seller.whatsappSetupRequestedAt !== undefined}
              payoutsRequested={seller.payoutsSetupRequestedAt !== undefined}
            />
          )}
        </div>

        <div>{!hasAnyOrders && <HowItWorks />}</div>
      </div>
    </LargeTitlePage>
  )
}
