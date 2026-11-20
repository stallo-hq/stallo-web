import { Check, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSpinner } from '../../components/ui/Spinner'
import { useSeller } from '../../hooks/useSeller'
import { formatLongDate } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './ConnectionPage.module.css'
import { connectionStatus } from './connectionStatus'
import { useSettingsActions } from './useSettings'

export type ConnectionCopy = {
  kind: 'whatsapp' | 'payouts'
  icon: LucideIcon
  title: string
  description: string
  benefits: { title: string; text: string }[]
  checklist: string[]
  connectedText: string
}

/** Shared page for WhatsApp and payouts: what it does, what you need, and the next step. */
export function ConnectionPage({ copy }: { copy: ConnectionCopy }) {
  const seller = useSeller()
  const { requestSetup } = useSettingsActions()
  const [busy, setBusy] = useState(false)

  if (seller === undefined) return <PageSpinner />
  if (seller === null) return null

  const connected = copy.kind === 'whatsapp' ? seller.whatsappConnected : seller.payoutsConnected
  const requestedAt = copy.kind === 'whatsapp' ? seller.whatsappSetupRequestedAt : seller.payoutsSetupRequestedAt
  const status = connectionStatus(connected, requestedAt)
  const Icon = copy.icon

  async function request() {
    setBusy(true)
    try {
      await requestSetup({ kind: copy.kind })
      toast.success('Request sent. We’ll call you to finish setting it up.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} back={{ to: '/app/settings', label: 'Settings' }} />
      <div className={styles.layout}>
        <Card className={styles.status}>
          <span className={styles.statusIcon}>
            <Icon size={24} />
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
          {status.state === 'connected' && <p>{copy.connectedText}</p>}
          {status.state === 'requested' && (
            <p>
              Requested on {formatLongDate(requestedAt)}. The Stallo team will call you on{' '}
              <strong>{formatGhanaPhone(seller.phone)}</strong> to finish setting it up.
            </p>
          )}
          {status.state === 'none' && (
            <>
              <p>During the pilot, the Stallo team sets this up with you on a short call. Request it and we’ll be in touch.</p>
              <Button variant="primary" size="lg" block loading={busy} onClick={() => void request()}>
                Request setup
              </Button>
            </>
          )}
        </Card>

        <div className={styles.details}>
          <Card title="What you get">
            <ul className={styles.benefits}>
              {copy.benefits.map((b) => (
                <li key={b.title}>
                  <Check size={18} />
                  <div>
                    <strong>{b.title}</strong>
                    <span>{b.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Have these ready">
            <ol className={styles.checklist}>
              {copy.checklist.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}
