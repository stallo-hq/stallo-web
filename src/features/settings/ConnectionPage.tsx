import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonText } from '@ionic/react'
import { checkmarkCircle, timeOutline } from 'ionicons/icons'
import { useState } from 'react'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { SectionFooter } from '../../components/SectionFooter'
import { SectionHeader } from '../../components/SectionHeader'
import { formatLongDate } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { formatGhanaPhone } from '../../lib/phone'
import { connectionStatus } from './connectionStatus'

export type ConnectionCopy = {
  title: string
  icon: string
  intro: string
  benefits: { icon: string; title: string; detail: string }[]
  needs: string[]
  requestLabel: string
}

/**
 * Detail page for a connection (WhatsApp or payouts). During the pilot the
 * Stallo team connects these with each seller, so the action is a request.
 */
export function ConnectionPage({
  copy,
  connected,
  requestedAt,
  phone,
  onRequest,
}: {
  copy: ConnectionCopy
  connected: boolean
  requestedAt: number | undefined
  phone: string
  onRequest: () => Promise<unknown>
}) {
  const status = connectionStatus(connected, requestedAt)
  const [sending, setSending] = useState(false)

  async function request() {
    setSending(true)
    try {
      await onRequest()
      haptic('success')
    } finally {
      setSending(false)
    }
  }

  return (
    <LargeTitlePage title={copy.title} backHref="/settings">
      <div className="hero-status">
        <IonIcon
          icon={status.state === 'connected' ? checkmarkCircle : status.state === 'requested' ? timeOutline : copy.icon}
          color={status.state === 'connected' ? 'success' : status.state === 'requested' ? 'warning' : 'primary'}
          aria-hidden="true"
        />
        <p className="text-headline">
          {status.state === 'connected' ? 'Connected' : status.state === 'requested' ? 'Setup requested' : copy.intro}
        </p>
        {status.state === 'requested' && requestedAt !== undefined && (
          <IonText color="medium">
            <p className="text-subheadline">
              Requested on {formatLongDate(requestedAt)}. The Stallo team will call you on{' '}
              {formatGhanaPhone(phone)} to finish setting it up.
            </p>
          </IonText>
        )}
      </div>

      <SectionHeader>What you get</SectionHeader>
      <IonList inset>
        {copy.benefits.map((b) => (
          <IonItem key={b.title}>
            <IonIcon slot="start" icon={b.icon} color="primary" aria-hidden="true" />
            <IonLabel className="ion-text-wrap">
              <h2>{b.title}</h2>
              <p>{b.detail}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>

      {status.state !== 'connected' && (
        <>
          <SectionHeader>Have these ready</SectionHeader>
          <IonList inset>
            {copy.needs.map((n, i) => (
              <IonItem key={n}>
                <IonText slot="start" color="medium" className="step-number">
                  {i + 1}
                </IonText>
                <IonLabel className="ion-text-wrap">{n}</IonLabel>
              </IonItem>
            ))}
          </IonList>
          <SectionFooter>
            During the pilot, the Stallo team sets this up with you over a short call.
          </SectionFooter>

          {status.state === 'none' && (
            <div className="ion-padding-horizontal">
              <IonButton expand="block" onClick={request} disabled={sending}>
                {sending ? <IonSpinner name="crescent" /> : copy.requestLabel}
              </IonButton>
            </div>
          )}
        </>
      )}
    </LargeTitlePage>
  )
}
