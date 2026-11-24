import { Check } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageSpinner } from '../../components/ui/Spinner'
import { useSeller } from '../../hooks/useSeller'
import { cx } from '../../lib/cx'
import { formatLongDate, formatShortDateTime, greeting } from '../../lib/dates'
import { formatCedis } from '../../lib/money'
import { OrderTable } from '../orders/OrderTable'
import { useOrders } from '../orders/useOrders'
import styles from './OverviewPage.module.css'
import { useOverview, useResolveAttention } from './useOverview'

function Stat({ label, value, note, to }: { label: string; value: string; note?: string; to?: string }) {
  const body = (
    <>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} num`}>{value}</strong>
      {note && <span className={styles.statNote}>{note}</span>}
    </>
  )
  return to ? (
    <Link to={to} className={styles.stat}>
      {body}
    </Link>
  ) : (
    <div className={styles.stat}>{body}</div>
  )
}

type Setup = { hasProducts: boolean; whatsappConnected: boolean; payoutsConnected: boolean }

function SetupChecklist({ setup, hasOrders }: { setup: Setup; hasOrders: boolean }) {
  const steps = [
    {
      done: setup.hasProducts,
      title: 'Add what you sell',
      text: 'Stallo takes names and prices from this list. It never makes up a price.',
      to: '/app/products',
      action: 'Add products',
    },
    {
      done: setup.payoutsConnected,
      title: 'Set up payouts',
      text: 'The MoMo or bank account Paystack pays your money into.',
      to: '/app/settings/payouts',
      action: 'Set up payouts',
    },
    {
      done: setup.whatsappConnected,
      title: 'Link your WhatsApp',
      text: 'Scan a QR code with the phone your business number is on.',
      to: '/app/settings/whatsapp',
      action: 'Link WhatsApp',
    },
  ]
  const next = steps.findIndex((s) => !s.done)
  return (
    <Card title={hasOrders ? 'Finish setting up' : 'Before your first order'} flush>
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.title} className={cx(styles.step, s.done && styles.stepDone)}>
            <span className={styles.stepMark}>{s.done ? <Check size={14} /> : i + 1}</span>
            <div className={styles.stepText}>
              <strong>{s.title}</strong>
              {!s.done && <span>{s.text}</span>}
            </div>
            {s.done ? (
              <span className={styles.stepState}>Done</span>
            ) : (
              <ButtonLink to={s.to} size="sm" variant={i === next ? 'dark' : 'secondary'}>
                {s.action}
              </ButtonLink>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Attention({
  items,
  onResolve,
}: {
  items: NonNullable<ReturnType<typeof useOverview>>['attention']
  onResolve: (id: (typeof items)[number]['_id']) => void
}) {
  if (items.length === 0) {
    return <p className={styles.quiet}>Nothing needs you right now. Unclear messages, failed payments and stock problems show up here.</p>
  }
  return (
    <Card title={`Needs attention (${items.length})`} className={styles.spaced} flush>
      <ul className={styles.attention}>
        {items.map((a) => (
          <li key={a._id}>
            <div>
              <strong>{a.summary}</strong>
              {a.imageUrl && (
                <a href={a.imageUrl} target="_blank" rel="noopener noreferrer" className={styles.attentionImage}>
                  <img src={a.imageUrl} alt="Picture the customer sent" loading="lazy" />
                </a>
              )}
              <span>
                {formatShortDateTime(a.createdAt)}
                {a.orderId && (
                  <>
                    {' · '}
                    <Link to={`/app/orders/${a.orderId}`}>View order</Link>
                  </>
                )}
              </span>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onResolve(a._id)}>
              Mark done
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function OverviewPage() {
  const seller = useSeller()
  const overview = useOverview()
  const resolve = useResolveAttention()
  const recent = useOrders('all')

  if (overview === undefined || seller === undefined) return <PageSpinner />
  if (overview === null || seller === null) return null

  const { setup, stats } = overview
  const setupDone = setup.hasProducts && setup.whatsappConnected && setup.payoutsConnected

  return (
    <>
      <PageHeader title={seller.businessName} description={`${greeting()}. ${formatLongDate()}.`} />

      {!setupDone && <SetupChecklist setup={setup} hasOrders={(recent?.length ?? 0) > 0} />}

      <Attention items={overview.attention} onResolve={(id) => void resolve({ id })} />

      <div className={styles.stats}>
        <Stat label="Orders today" value={String(stats.ordersToday)} />
        <Stat label="Paid today" value={formatCedis(stats.paidTodayPesewas)} note="Before fees" />
        <Stat label="Waiting for payment" value={String(stats.awaitingPayment)} to="/app/orders" />
        <Stat label="Paid, not sent out" value={String(stats.toDeliver)} to="/app/orders" />
      </div>

      <Card
        title="Latest orders"
        className={styles.spaced}
        actions={
          recent && recent.length > 0 ? (
            <Link to="/app/orders" className={styles.cardLink}>
              All orders
            </Link>
          ) : undefined
        }
        flush
      >
        {recent === undefined ? (
          <PageSpinner />
        ) : recent.length === 0 ? (
          <EmptyState
            title="No orders yet"
            action={
              !setup.hasProducts ? (
                <ButtonLink to="/app/products" variant="dark">
                  Add your products
                </ButtonLink>
              ) : undefined
            }
          >
            When a customer messages your WhatsApp number, the order appears here as soon as Stallo has read it.
          </EmptyState>
        ) : (
          <OrderTable orders={recent.slice(0, 8)} />
        )}
      </Card>
    </>
  )
}
