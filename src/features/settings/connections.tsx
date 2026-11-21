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
import { useEmbeddedSignup } from './useEmbeddedSignup'
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
    'The WhatsApp number you sell on, and the phone it’s on (to receive a code)',
    'A Facebook account to sign in to Meta during setup',
    'Your business name as registered, if Meta asks for it',
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
  const integrations = useIntegrations()
  if (seller === undefined || integrations === undefined) return <PageSpinner />
  if (seller === null) return null

  return (
    <ConnectionPage copy={WHATSAPP} connected={seller.whatsappConnected}>
      {seller.whatsappConnected ? (
        <WhatsAppConnected phone={seller.whatsappDisplayPhone} />
      ) : (
        <>
          {integrations.embeddedSignup ? (
            <EmbeddedSignup config={integrations.embeddedSignup} />
          ) : (
            <p>WhatsApp sign-up isn’t switched on for Stallo yet. Check back soon.</p>
          )}
          {integrations.manualWhatsApp && <ManualConnect />}
        </>
      )}
    </ConnectionPage>
  )
}

function WhatsAppConnected({ phone }: { phone?: string }) {
  const { disconnect } = useWhatsAppConnection()
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <p>
        Customers can order on <strong>{phone ? formatGhanaPhone(phone) : 'your WhatsApp number'}</strong>. Stallo replies within
        seconds and brings anything unclear to you.
      </p>
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Disconnect
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Disconnect WhatsApp?"
        description="Stallo will stop reading and replying to messages on this number. Orders already placed are kept."
        confirmLabel="Disconnect"
        destructive
        onConfirm={async () => {
          await disconnect({})
          toast.success('WhatsApp disconnected')
        }}
      />
    </>
  )
}

function EmbeddedSignup({ config }: { config: { appId: string; configId: string; graphVersion: string } }) {
  const { ready, loadError, start } = useEmbeddedSignup(config)
  const { completeSignup } = useWhatsAppConnection()
  const [busy, setBusy] = useState<'keep' | 'new' | null>(null)

  async function connect(keepBusinessApp: boolean) {
    setBusy(keepBusinessApp ? 'keep' : 'new')
    try {
      const result = await start(keepBusinessApp)
      await completeSignup({ ...result, keepBusinessApp })
      toast.success('WhatsApp connected')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <p>Sign in to Meta in the window that opens and choose your number. It takes about five minutes.</p>
      <div className={styles.choices}>
        <Button variant="primary" size="lg" block loading={busy === 'keep'} disabled={!ready || busy !== null} onClick={() => void connect(true)}>
          Use my WhatsApp Business number
        </Button>
        <span className={styles.choiceHint}>
          Keep using the WhatsApp Business app on your phone as well. When you reply to a customer yourself, Stallo stays quiet in that chat for 30
          minutes.
        </span>
        <Button variant="secondary" size="lg" block loading={busy === 'new'} disabled={!ready || busy !== null} onClick={() => void connect(false)}>
          Use a new number
        </Button>
        <span className={styles.choiceHint}>A number that isn’t on WhatsApp yet. Stallo handles all its messages.</span>
      </div>
      {loadError && <p className={styles.error}>{loadError}</p>}
    </>
  )
}

function ManualConnect() {
  const { connectManually } = useWhatsAppConnection()
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await connectManually({ phoneNumberId: id })
      toast.success('WhatsApp connected')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.manual} onSubmit={(e) => void submit(e)} noValidate>
      <strong>Test number</strong>
      <span>Connect a number from Stallo’s own Meta account, such as Meta’s free test number.</span>
      <Field
        label="Phone number ID"
        inputMode="numeric"
        value={id}
        onChange={(e) => setId(e.target.value)}
        error={error}
        hint="From WhatsApp → API setup in the Meta developer dashboard."
      />
      <Button type="submit" variant="dark" loading={busy}>
        Connect
      </Button>
    </form>
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
