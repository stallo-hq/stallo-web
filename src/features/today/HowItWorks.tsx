import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/react'
import { bicycleOutline, cardOutline, chatbubblesOutline } from 'ionicons/icons'
import { SectionHeader } from '../../components/SectionHeader'

const STEPS = [
  {
    icon: chatbubblesOutline,
    title: 'Customer orders on WhatsApp',
    detail: 'They message your number as usual. Stallo reads the order and confirms it with them.',
  },
  {
    icon: cardOutline,
    title: 'They pay by MoMo or card',
    detail: 'Stallo sends a secure Paystack link. You see the payment here straight away.',
  },
  {
    icon: bicycleOutline,
    title: 'You send it out',
    detail: 'Add your rider. The customer gets a delivery PIN, and the rider confirms it at handoff.',
  },
]

/** Shown until the first order arrives, so new sellers understand the flow. */
export function HowItWorks() {
  return (
    <section aria-label="How Stallo works">
      <SectionHeader>How Stallo works</SectionHeader>
      <IonList inset>
        {STEPS.map((s) => (
          <IonItem key={s.title}>
            <IonIcon slot="start" icon={s.icon} color="primary" aria-hidden="true" />
            <IonLabel className="ion-text-wrap">
              <h2>{s.title}</h2>
              <p>{s.detail}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
    </section>
  )
}
