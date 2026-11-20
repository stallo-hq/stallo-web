import { IonIcon, IonItem, IonLabel, IonList, IonProgressBar } from '@ionic/react'
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons'
import { SectionHeader } from '../../components/SectionHeader'

type Step = { key: string; title: string; detail: string; href: string; done: boolean }

/** "Get set up" card: the three things a seller must do before taking orders. */
export function SetupChecklist({
  hasProducts,
  whatsappConnected,
  payoutsConnected,
  whatsappRequested,
  payoutsRequested,
}: {
  hasProducts: boolean
  whatsappConnected: boolean
  payoutsConnected: boolean
  whatsappRequested: boolean
  payoutsRequested: boolean
}) {
  const steps: Step[] = [
    {
      key: 'products',
      title: 'Add what you sell',
      detail: 'Stallo uses your prices, so customers are always charged correctly.',
      href: '/products',
      done: hasProducts,
    },
    {
      key: 'whatsapp',
      title: 'Connect WhatsApp',
      detail: whatsappRequested
        ? 'Requested. The Stallo team will contact you to finish.'
        : 'Customers order in chat on your number.',
      href: '/settings/whatsapp',
      done: whatsappConnected,
    },
    {
      key: 'payouts',
      title: 'Set up payouts',
      detail: payoutsRequested
        ? 'Requested. The Stallo team will contact you to finish.'
        : 'Get paid to your MoMo or bank account.',
      href: '/settings/payouts',
      done: payoutsConnected,
    },
  ]
  const done = steps.filter((s) => s.done).length

  return (
    <section aria-label="Get set up">
      <SectionHeader detail={`${done} of ${steps.length} done`}>Get set up</SectionHeader>
      <IonList inset>
        <IonProgressBar
          value={done / steps.length}
          color="success"
          aria-label={`${done} of ${steps.length} setup steps done`}
        />
        {steps.map((s) => (
          <IonItem
            key={s.key}
            routerLink={s.done ? undefined : s.href}
            detail={!s.done}
            button={!s.done}
          >
            <IonIcon
              slot="start"
              icon={s.done ? checkmarkCircle : ellipseOutline}
              color={s.done ? 'success' : 'medium'}
              aria-hidden="true"
            />
            <IonLabel className="ion-text-wrap">
              <h2>{s.title}</h2>
              <p>{s.done ? 'Done' : s.detail}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
    </section>
  )
}
