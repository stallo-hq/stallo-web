import { CreditCard, MessageCircle, Smartphone } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { PageSpinner } from '../../components/ui/Spinner'
import { useSeller } from '../../hooks/useSeller'
import { errorMessage } from '../../lib/errors'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './ConnectionPage.module.css'
import { ConnectionPage, type ConnectionCopy } from './ConnectionPage'
import { useIntegrations, usePayoutActions, useWhatsAppConnection } from './useSettings'

const WHATSAPP: ConnectionCopy = {
  icon: MessageCircle,
  title: 'WhatsApp',
  description: 'Connect the number your customers already message.',
  benefits: [
    { title: 'Customers order the way they already do', text: 'Plain messages in English, Twi or Pidgin become orders.' },
    { title: 'Replies even when you’re busy', text: 'Stallo confirms orders and sends payment links any time of day.' },
    { title: 'You stay in control', text: 'Anything unclear comes to you under Needs attention instead of being guessed.' },
  ],
  checklist: [
    'The phone with the WhatsApp or WhatsApp Business number you sell on',
    'That phone connected to the internet',
    'A minute to scan a code, the same way you link WhatsApp Web',
  ],
}

const PAYOUTS: ConnectionCopy = {
  icon: CreditCard,
  title: 'Payouts',
  description: 'Choose where the money from your orders goes.',
  benefits: [
    { title: 'Customers pay by MoMo or card', text: 'Each confirmed order gets a secure Paystack payment link.' },
    { title: 'Money goes to your own account', text: 'Paystack settles your share to your MoMo wallet or bank account.' },
    { title: 'Every payment on record', text: 'See what was paid, when, and the fee, order by order.' },
  ],
  checklist: ['Your MoMo number or bank account number', 'The name on that account', 'Your provider or bank'],
}

// ---------------------------------------------------------------------------

export function WhatsAppPage() {
  const seller = useSeller()
  const { status, start, disconnect } = useWhatsAppConnection()
  if (seller === undefined || status === undefined) return <PageSpinner />
  if (seller === null) return null

  return (
    <ConnectionPage copy={WHATSAPP} connected={status.state === 'open'}>
      {status.state === 'open' ? (
        <WhatsAppConnected phone={status.phone ?? undefined} disconnect={disconnect} />
      ) : !status.available ? (
        <p>WhatsApp linking isn’t switched on for Stallo yet. Check back soon.</p>
      ) : (
        <QrLink status={status} start={start} />
      )}
    </ConnectionPage>
  )
}

type LinkStatus = NonNullable<ReturnType<typeof useWhatsAppConnection>['status']>

/** Counts down to `until`, so the button says when a new code can be asked for. */
function useSecondsUntil(until: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= Date.now()) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [until])
  return Math.max(0, Math.ceil((until - now) / 1000))
}

function QrLink({ status, start }: { status: LinkStatus; start: () => Promise<null> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wait = useSecondsUntil(status.canStartAt)
  const waiting = status.state === 'connecting'

  async function showCode() {
    setError(null)
    setBusy(true)
    try {
      await start()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ol className={styles.steps}>
        <li>On your phone, open WhatsApp and go to Settings, then Linked devices.</li>
        <li>Tap Link a device and point your phone at the code below.</li>
        <li>Keep your phone on and connected. You can still use WhatsApp on it as normal.</li>
      </ol>
      {status.qr ? (
        <img className={styles.qr} src={status.qr} alt="QR code to link your WhatsApp to Stallo" width={240} height={240} />
      ) : waiting ? (
        <p className={styles.qrWaiting}>Getting your code…</p>
      ) : null}
      <Button variant={status.qr ? 'secondary' : 'primary'} size="lg" loading={busy} disabled={wait > 0} onClick={() => void showCode()}>
        {wait > 0 ? `New code in ${wait}s` : status.qr || waiting ? 'Show a new code' : 'Show QR code'}
      </Button>
      {(error ?? status.error) && <p className={styles.error}>{error ?? status.error}</p>}
      <p className={styles.choiceHint}>
        Stallo only replies to people who message you first, and never sends promotions from your number. When you reply to a customer yourself,
        Stallo stays quiet in that chat for 3 hours.
      </p>
    </>
  )
}

function WhatsAppConnected({ phone, disconnect }: { phone?: string; disconnect: () => Promise<null> }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <p>
        Customers can order on <strong>{phone ? formatGhanaPhone(phone) : 'your WhatsApp number'}</strong>. Stallo replies within
        seconds and brings anything unclear to you. When you reply to a customer yourself, Stallo stays quiet in that chat for 3 hours.
      </p>
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Disconnect
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Disconnect WhatsApp?"
        description="Stallo will unlink from your phone and stop reading and replying to messages on this number. Orders already placed are kept."
        confirmLabel="Disconnect"
        destructive
        onConfirm={async () => {
          try {
            await disconnect()
            toast.success('WhatsApp disconnected')
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------

type PayoutType = 'mobile_money' | 'bank'

export function PayoutsPage() {
  const seller = useSeller()
  const integrations = useIntegrations()
  const [editing, setEditing] = useState(false)
  if (seller === undefined || integrations === undefined) return <PageSpinner />
  if (seller === null) return null

  const payout = seller.payout
  return (
    <ConnectionPage copy={PAYOUTS} connected={seller.payoutsConnected}>
      {!integrations.payments ? (
        <p>Payments aren’t switched on for Stallo yet. Check back soon.</p>
      ) : payout && !editing ? (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>{payout.type === 'bank' ? 'Bank' : 'Provider'}</dt>
              <dd>{payout.providerName}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd className="num">•••• {payout.accountLast4}</dd>
            </div>
            {payout.accountName && (
              <div>
                <dt>Name</dt>
                <dd>{payout.accountName}</dd>
              </div>
            )}
          </dl>
          <p>Your share of every paid order is settled here by Paystack.</p>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Change account
          </Button>
        </>
      ) : (
        <PayoutForm initialType={payout?.type ?? 'mobile_money'} onDone={() => setEditing(false)} canCancel={Boolean(payout)} />
      )}
    </ConnectionPage>
  )
}

function PayoutForm({ initialType, onDone, canCancel }: { initialType: PayoutType; onDone: () => void; canCancel: boolean }) {
  const { providers: loadProviders, connect } = usePayoutActions()
  const [type, setType] = useState<PayoutType>(initialType)
  const [providers, setProviders] = useState<{ name: string; code: string }[] | null>(null)
  const [provider, setProvider] = useState('')
  const [account, setAccount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    loadProviders({ type })
      .then((r) => alive && setProviders(r.providers))
      .catch((err) => alive && setError(errorMessage(err)))
    return () => {
      alive = false
    }
  }, [type, loadProviders])

  function changeType(next: PayoutType) {
    setType(next)
    setProviders(null)
    setProvider('')
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const chosen = providers?.find((p) => p.code === provider)
    if (!chosen) return setError(type === 'bank' ? 'Choose your bank.' : 'Choose your mobile money provider.')
    setBusy(true)
    try {
      const { accountName } = await connect({ type, providerCode: chosen.code, providerName: chosen.name, accountNumber: account })
      toast.success(accountName ? `Payouts will go to ${accountName}` : 'Payout account saved')
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <Segmented
        label="Account type"
        value={type}
        onChange={changeType}
        options={[
          { value: 'mobile_money', label: 'Mobile money' },
          { value: 'bank', label: 'Bank account' },
        ]}
      />
      <Select
        label={type === 'bank' ? 'Bank' : 'Provider'}
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        disabled={providers === null}
        placeholder={providers === null ? 'Loading…' : 'Choose'}
        options={(providers ?? []).map((p) => ({ value: p.code, label: p.name }))}
      />
      <Field
        label={type === 'bank' ? 'Account number' : 'Wallet number'}
        inputMode="numeric"
        autoComplete="off"
        prefix={type === 'mobile_money' ? <Smartphone size={16} /> : undefined}
        placeholder={type === 'mobile_money' ? '024 123 4567' : ''}
        value={account}
        onChange={(e) => setAccount(e.target.value)}
        hint="Check it carefully. Paystack pays out to exactly this account."
      />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" size="lg" loading={busy}>
          Save payout account
        </Button>
        {canCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
