import { DEFAULT_MIN_PASSWORD_LENGTH } from '@convex-dev/auth/methods/username-password'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { ChevronRight, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { authMessage } from '../../../convex/lib/authMessages'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, PasswordField } from '../../components/ui/Field'
import { PageSpinner } from '../../components/ui/Spinner'
import { useSeller } from '../../hooks/useSeller'
import { errorMessage } from '../../lib/errors'
import { Switch } from '../../components/ui/Switch'
import { formatCedis, formatFee, parseCedis, pesewasToInput } from '../../lib/money'
import { formatGhanaPhone } from '../../lib/phone'
import { connectionStatus } from './connectionStatus'
import styles from './SettingsPage.module.css'
import { useSettingsActions } from './useSettings'

function BusinessCard({ name, phone }: { name: string; phone: string }) {
  const { updateBusinessName } = useSettingsActions()
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await updateBusinessName({ businessName: value })
      toast.success('Business name saved')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card plain title="Business" description="How customers see you in WhatsApp and on payment pages.">
      <form onSubmit={save} noValidate className={styles.form}>
        <Field label="Business name" value={value} maxLength={80} onChange={(e) => setValue(e.target.value)} error={error} />
        <Field label="Phone number" value={formatGhanaPhone(phone)} readOnly hint="You sign in with this number. It can’t be changed here." />
        <div className={styles.formActions}>
          <Button type="submit" variant="dark" loading={busy} disabled={value.trim() === name}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  )
}

function DeliveryAreasCard({ areas }: { areas: string }) {
  const { updateDeliveryAreas } = useSettingsActions()
  const [value, setValue] = useState(areas)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await updateDeliveryAreas({ deliveryAreas: value })
      toast.success(value.trim() ? 'Delivery areas saved' : 'Delivery areas cleared')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      plain
      title="Delivery areas"
      description="Where you deliver. When a customer gives an address that looks outside these areas, Stallo tells them you will check, and flags the order for you."
    >
      <form onSubmit={save} noValidate className={styles.form}>
        <Field
          label="Areas you deliver to"
          placeholder="Madina, Adenta, Legon, East Legon"
          value={value}
          maxLength={300}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          hint="Towns, suburbs or landmarks, separated by commas. Leave empty to accept any address."
        />
        <div className={styles.formActions}>
          <Button type="submit" variant="dark" loading={busy} disabled={value.trim() === areas}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  )
}

function DeliveryPaymentCard({ feePesewas, acceptsCash, balancePesewas }: { feePesewas: number; acceptsCash: boolean; balancePesewas: number }) {
  const { updateDeliveryAndPayment } = useSettingsActions()
  const [fee, setFee] = useState(feePesewas > 0 ? pesewasToInput(feePesewas) : '')
  const [cash, setCash] = useState(acceptsCash)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const parsed = fee.trim() === '' ? 0 : parseCedis(fee)
  const changed = parsed !== feePesewas || cash !== acceptsCash

  async function save(e: FormEvent) {
    e.preventDefault()
    if (parsed === null) return setError('Enter an amount, for example 20, or leave it empty for free delivery.')
    setError(null)
    setBusy(true)
    try {
      await updateDeliveryAndPayment({ deliveryFeePesewas: parsed, acceptsCash: cash })
      toast.success('Delivery and payment saved')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card plain title="Delivery and payment" description="What customers pay for delivery, and how they can pay.">
      <form onSubmit={save} noValidate className={styles.form}>
        <Field
          label="Delivery fee"
          prefix="GH₵"
          inputMode="decimal"
          placeholder="0.00"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          error={error ?? undefined}
          hint="Added to every order. Leave empty for free delivery. Stallo’s fee is never taken from it."
        />
        <Switch
          label="Accept cash on delivery"
          hint="Customers can choose to pay the rider in cash. If you charge a delivery fee, they pay that online first."
          checked={cash}
          onCheckedChange={setCash}
        />
        {balancePesewas > 0 && (
          <p className={styles.note}>
            Stallo fees from cash orders: {formatCedis(balancePesewas)}. They are taken from your next online payments, never more than half
            of any one payment.
          </p>
        )}
        <div className={styles.formActions}>
          <Button type="submit" variant="dark" loading={busy} disabled={!changed}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ConnectionRow({ to, title, text, connected }: {
  to: string
  title: string
  text: string
  connected: boolean
}) {
  const status = connectionStatus(connected)
  return (
    <Link to={to} className={styles.connection}>
      <span className={styles.connectionText}>
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <Badge tone={status.tone}>{status.label}</Badge>
      <ChevronRight size={18} className={styles.chevron} />
    </Link>
  )
}

function PasswordCard() {
  const { changePassword } = useSettingsActions()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < DEFAULT_MIN_PASSWORD_LENGTH) return setError(`Use at least ${DEFAULT_MIN_PASSWORD_LENGTH} characters.`)
    setBusy(true)
    try {
      const result = await changePassword({ currentPassword: current, newPassword: next, signOutOtherSessions: true })
      if (!result.success) {
        setError(result.userError.error === 'INVALID_CREDENTIALS' ? 'Your current password isn’t right.' : authMessage(result.userError.error))
        return
      }
      setCurrent('')
      setNext('')
      toast.success('Password changed. Other devices have been signed out.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card plain title="Password" description="Changing it signs you out on every other device.">
      <form onSubmit={save} noValidate className={styles.form}>
        <div className={styles.twoCols}>
          <PasswordField label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <PasswordField label="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" variant="dark" loading={busy} disabled={!current || !next}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function SettingsPage() {
  const seller = useSeller()
  const pricing = useQuery(api.site.pricing)
  const { signOut } = useAuthActions()
  const navigate = useNavigate()

  if (seller === undefined) return <PageSpinner />
  if (seller === null) return null
  const fee = pricing ? formatFee(pricing) : null

  return (
    <>
      <PageHeader title="Settings" description="Your business, connections and account." />
      <div className={styles.stack}>
        {/* key: start fresh whenever the saved name changes */}
        <BusinessCard key={seller.businessName} name={seller.businessName} phone={seller.phone} />
        <DeliveryPaymentCard
          key={`${seller.deliveryFeePesewas}-${seller.acceptsCash}`}
          feePesewas={seller.deliveryFeePesewas}
          acceptsCash={seller.acceptsCash}
          balancePesewas={seller.feeBalancePesewas}
        />
        <DeliveryAreasCard key={seller.deliveryAreas ?? ''} areas={seller.deliveryAreas ?? ''} />

        <Card plain title="Connections" description="What Stallo needs to take orders and pay you." flush>
          <ConnectionRow
            to="/app/settings/whatsapp"
            title="WhatsApp"
            text="Where customers send their orders"
            connected={seller.whatsappConnected}
          />
          <ConnectionRow
            to="/app/settings/payouts"
            title="Payouts"
            text="The MoMo or bank account you get paid to"
            connected={seller.payoutsConnected}
          />
        </Card>

        <Card plain title="Fees" description="What Stallo costs. There is no monthly fee.">
          <p className={styles.fee}>
            {fee ? (
              <>
                <strong className="num">{fee}</strong> per paid order, taken automatically when the customer pays.
              </>
            ) : (
              'No Stallo fee is set for your account yet.'
            )}{' '}
            Paystack’s own processing fee also applies.
          </p>
        </Card>

        <PasswordCard />

        <Card plain title="Sign out" description="Sign out of Stallo on this device.">
          <Button icon={<LogOut size={17} />} onClick={() => void signOut().then(() => navigate('/', { replace: true }))}>
            Sign out
          </Button>
        </Card>
      </div>
    </>
  )
}
