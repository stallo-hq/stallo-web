import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock,
  Inbox,
  Package,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from 'lucide-react'
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

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>
        <Icon size={16} /> {label}
      </span>
      <strong className={`${styles.statValue} num`}>{value}</strong>
      <span className={styles.statHint}>{hint}</span>
    </div>
  )
}

type Setup = { hasProducts: boolean; whatsappConnected: boolean; payoutsConnected: boolean }

function SetupChecklist({ setup }: { setup: Setup }) {
  const steps = [
    {
      done: setup.hasProducts,
      title: 'Add what you sell',
      text: 'Stallo uses your product names and prices to build orders.',
      to: '/app/products',
      action: 'Add products',
    },
    {
      done: setup.payoutsConnected,
      title: 'Set up payouts',
      text: 'Choose the MoMo or bank account your money goes to.',
      to: '/app/settings/payouts',
      action: 'Set up payouts',
    },
    {
      done: setup.whatsappConnected,
      title: 'Connect WhatsApp',
      text: 'Link your business number so customers can order in chat.',
      to: '/app/settings/whatsapp',
      action: 'Connect',
    },
  ]
  const done = steps.filter((s) => s.done).length
  return (
    <Card
      title="Get set up"
      description={`${done} of ${steps.length} done. Finish these and you’re ready for your first order.`}
      flush
    >
      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.title} className={cx(styles.step, s.done && styles.stepDone)}>
            <span className={styles.stepMark}>{s.done ? <Check size={15} /> : i + 1}</span>
            <div className={styles.stepText}>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </div>
            {!s.done && (
              <ButtonLink to={s.to} size="sm" variant={i === steps.findIndex((x) => !x.done) ? 'dark' : 'secondary'}>
                {s.action}
              </ButtonLink>
            )}
          </li>
        ))}
      </ol>
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
      <PageHeader
        title={`${greeting()}, ${seller.businessName}`}
        description={`${formatLongDate()} · here’s your shop today.`}
        actions={
          <ButtonLink to="/app/orders" variant="secondary" icon={<ShoppingBag size={17} />}>
            View orders
          </ButtonLink>
        }
      />

      {!setupDone && <SetupChecklist setup={setup} />}

      <div className={styles.stats}>
        <Stat icon={ShoppingBag} label="Orders today" value={String(stats.ordersToday)} hint="Placed on WhatsApp" />
        <Stat icon={CircleDollarSign} label="Paid today" value={formatCedis(stats.paidTodayPesewas)} hint="Before Stallo and Paystack fees" />
        <Stat icon={Clock} label="Awaiting payment" value={String(stats.awaitingPayment)} hint="Payment link sent" />
        <Stat icon={Truck} label="To deliver" value={String(stats.toDeliver)} hint="Paid, not sent out yet" />
      </div>

      <div className={styles.columns}>
        <Card
          title="Recent orders"
          actions={
            recent && recent.length > 0 ? (
              <Link to="/app/orders" className={styles.cardLink}>
                View all <ArrowRight size={15} />
              </Link>
            ) : undefined
          }
          flush
        >
          {recent === undefined ? (
            <PageSpinner />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No orders yet"
              action={
                !setup.hasProducts ? (
                  <ButtonLink to="/app/products" variant="dark" icon={<Package size={17} />}>
                    Add your products
                  </ButtonLink>
                ) : undefined
              }
            >
              When customers message your WhatsApp number, their orders show up here as they come in.
            </EmptyState>
          ) : (
            <OrderTable orders={recent.slice(0, 6)} />
          )}
        </Card>

        <Card title="Needs attention" description="Things Stallo couldn’t finish without you." flush>
          {overview.attention.length === 0 ? (
            <div className={styles.allClear}>
              <span className={styles.allClearIcon}>
                <Check size={18} />
              </span>
              <div>
                <strong>All clear</strong>
                <p>Unclear messages, failed payments and stock problems will appear here.</p>
              </div>
            </div>
          ) : (
            <ul className={styles.attention}>
              {overview.attention.map((a) => (
                <li key={a._id}>
                  <AlertTriangle size={17} />
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
                  <Button size="sm" variant="ghost" onClick={() => void resolve({ id: a._id })} aria-label="Mark as done">
                    Done
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
