import { useMutation, useQuery } from 'convex/react'
import { CheckCircle2, MapPin, Phone, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { api } from '../../../convex/_generated/api'
import { LogoMark } from '../../components/Logo'
import { Button } from '../../components/ui/Button'
import { CodeInput } from '../../components/ui/CodeInput'
import { Field } from '../../components/ui/Field'
import { PageSpinner } from '../../components/ui/Spinner'
import { Switch } from '../../components/ui/Switch'
import { errorMessage } from '../../lib/errors'
import { formatCedis } from '../../lib/money'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './RiderPage.module.css'

/**
 * The rider's page, opened from the WhatsApp message. No login: the link is the key.
 * Shows where to go, lets the rider call the customer, and confirms delivery with the customer's code.
 */
export function RiderPage() {
  const { token = '' } = useParams()
  const job = useQuery(api.deliveries.riderJob, { token })
  const confirm = useMutation(api.deliveries.riderConfirm)
  const reportFailed = useMutation(api.deliveries.riderReportFailed)
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failing, setFailing] = useState(false)
  const [reason, setReason] = useState('')
  const [cashCollected, setCashCollected] = useState(false)

  if (job === undefined) return <PageSpinner />

  if (job === null) {
    return (
      <Shell>
        <div className={styles.result}>
          <XCircle size={40} />
          <h1>This link doesn’t work</h1>
          <p>Ask the seller to check the order and send it to you again.</p>
        </div>
      </Shell>
    )
  }

  async function submitPin(code: string) {
    if (code.length !== 4 || busy || job === null || job === undefined) return
    const cashDue = job.cashToCollectPesewas > 0
    if (cashDue && !cashCollected) {
      setMessage({ text: `Collect ${formatCedis(job.cashToCollectPesewas)} in cash first, then tick the box.`, tone: 'error' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const result = await confirm({ token, pin: code, ...(cashDue ? { cashCollected: true } : {}) })
      setMessage({ text: result.message, tone: result.ok ? 'ok' : 'error' })
      if (!result.ok) setPin('')
    } catch (err) {
      setMessage({ text: errorMessage(err), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function submitFailed(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await reportFailed({ token, reason })
    } catch (err) {
      setMessage({ text: errorMessage(err), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (job.status !== 'dispatched') {
    const delivered = job.status === 'delivered'
    return (
      <Shell business={job.businessName}>
        <div className={styles.result} data-tone={delivered ? 'ok' : 'error'}>
          {delivered ? <CheckCircle2 size={44} /> : <XCircle size={44} />}
          <h1>{delivered ? 'Delivered' : 'Delivery closed'}</h1>
          <p>
            Order {job.orderLabel} for {job.businessName}{' '}
            {delivered ? 'is complete. Thank you.' : 'is no longer open. Call the seller if you have questions.'}
          </p>
          <a className={styles.call} href={`tel:${job.sellerPhone}`}>
            <Phone size={17} /> Call {job.businessName}
          </a>
        </div>
      </Shell>
    )
  }

  const forSomeoneElse = Boolean(job.recipientName || job.recipientPhone)
  const buyer = job.customerName ?? formatGhanaPhone(job.customerPhone)

  return (
    <Shell business={job.businessName}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Delivery for {job.businessName}</p>
        <h1>Order {job.orderLabel}</h1>
        <ul className={styles.items}>
          {job.items.map((i, n) => (
            <li key={n}>
              <span>{i.qty} ×</span> {i.name}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        {forSomeoneElse ? (
          <>
            <h2>Deliver to</h2>
            <p className={styles.big}>{job.recipientName ?? (job.recipientPhone ? formatGhanaPhone(job.recipientPhone) : 'The receiver')}</p>
            <p className={styles.muted}>Ordered by {buyer}. Either of them can give you the delivery code.</p>
          </>
        ) : (
          <>
            <h2>Customer</h2>
            <p className={styles.big}>{buyer}</p>
          </>
        )}
        {job.address && <p>{job.address}</p>}
        {job.digitalAddress && (
          <p>
            Ghana Post digital address: <strong>{job.digitalAddress}</strong>
          </p>
        )}
        {job.address && !job.hasPin && !job.digitalAddress && (
          <p className={styles.muted}>No map pin was shared. Call before you set off to check the exact place.</p>
        )}
        <div className={styles.actions}>
          {forSomeoneElse && job.recipientPhone && (
            <a className={styles.call} href={`tel:${job.recipientPhone}`}>
              <Phone size={17} /> Call receiver
            </a>
          )}
          <a className={forSomeoneElse && job.recipientPhone ? styles.secondary : styles.call} href={`tel:${job.customerPhone}`}>
            <Phone size={17} /> {forSomeoneElse ? 'Call buyer' : 'Call customer'}
          </a>
          {job.mapsUrl && (
            <a className={styles.secondary} href={job.mapsUrl} target="_blank" rel="noopener noreferrer">
              <MapPin size={17} /> {job.hasPin ? 'Open map pin' : 'Search on map'}
            </a>
          )}
        </div>
      </section>

      {(job.cashToCollectPesewas > 0 || job.riderFeePesewas !== undefined) && (
        <section className={styles.card}>
          {job.cashToCollectPesewas > 0 && (
            <>
              <h2>Collect cash</h2>
              <p className={styles.amount}>{formatCedis(job.cashToCollectPesewas)}</p>
              <p className={styles.muted}>The customer pays this in cash when you hand over the order.</p>
            </>
          )}
          {job.riderFeePesewas !== undefined && (
            <p>
              Your fee: <strong>{formatCedis(job.riderFeePesewas)}</strong>
              {job.riderFeeFromCash
                ? `, kept from the cash. Give ${formatCedis(job.cashToCollectPesewas - job.riderFeePesewas)} to ${job.businessName}.`
                : `, paid by ${job.businessName}.`}
            </p>
          )}
        </section>
      )}

      <section className={styles.card}>
        <h2>Confirm delivery</h2>
        <p>When you hand over the order, ask for the 4-digit delivery code and enter it here.</p>
        {job.cashToCollectPesewas > 0 && (
          <Switch
            label={`I collected ${formatCedis(job.cashToCollectPesewas)} in cash`}
            checked={cashCollected}
            onCheckedChange={setCashCollected}
          />
        )}
        <div className={styles.pin}>
          <CodeInput length={4} size="large" value={pin} onChange={setPin} onComplete={(c) => void submitPin(c)} autoFocus={false} disabled={busy} invalid={message?.tone === 'error'} />
        </div>
        {message && (
          <p className={styles.message} data-tone={message.tone} role="status">
            {message.text}
          </p>
        )}
        <Button variant="dark" size="lg" block loading={busy} disabled={pin.length !== 4} onClick={() => void submitPin(pin)}>
          Confirm delivery
        </Button>
      </section>

      <section className={styles.card}>
        {failing ? (
          <form onSubmit={(e) => void submitFailed(e)} className={styles.failForm} noValidate>
            <h2>Couldn’t deliver?</h2>
            <Field label="What happened?" placeholder="e.g. Customer not answering" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className={styles.actions}>
              <Button type="submit" variant="danger" loading={busy}>
                Report failed delivery
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFailing(false)}>
                Back
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="ghost" block onClick={() => setFailing(true)}>
            I couldn’t deliver this order
          </Button>
        )}
      </section>
    </Shell>
  )
}

function Shell({ business, children }: { business?: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LogoMark size={26} />
        <span>{business ?? 'Stallo'}</span>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
