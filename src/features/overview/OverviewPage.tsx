import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleCheck,
  CircleDollarSign,
  Clock,
  Inbox,
  Package,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '../../components/ui/Badge'
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
import { TrackerPanel } from './TrackerPanel'
import { useOverview, useResolveAttention } from './useOverview'

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  featured = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  featured?: boolean
}) {
  return (
    <div className={cx(styles.stat, featured && styles.statFeatured)}>
      <div className={styles.statTop}>
        <span className={styles.statIcon}>
          <Icon size={16} />
        </span>
        <span className={styles.statLabel}>{label}</span>
      </div>
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
  const nextStep = steps.findIndex((step) => !step.done)
  return (
    <Card
      title="Get set up"
      description="Complete the basics to start taking orders."
      actions={<span className={styles.setupCount}>{done} of {steps.length} complete</span>}
      flush
    >
      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.title} className={cx(styles.step, s.done && styles.stepDone, i === nextStep && styles.stepNext)}>
            <span className={styles.stepMark}>{s.done ? <Check size={15} /> : i + 1}</span>
            <div className={styles.stepText}>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </div>
            {!s.done && (
              <ButtonLink to={s.to} size="sm" variant={i === nextStep ? 'primary' : 'secondary'}>
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
        eyebrow="Seller workspace"
        title={`${greeting()}, ${seller.businessName}`}
        description={`${formatLongDate()} · here’s your shop today.`}
        actions={
          <div className={styles.headerActions}>
            <Badge tone={setupDone ? 'green' : 'amber'}>
              {setupDone ? 'Shop ready' : 'Setup in progress'}
            </Badge>
            <ButtonLink to="/app/orders" variant="primary" icon={<ShoppingBag size={17} />}>
              View orders
            </ButtonLink>
          </div>
        }
      />

      {!setupDone && <SetupChecklist setup={setup} />}

      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionEyebrow}>DAILY SUMMARY</span>
          <h2>Today at a glance</h2>
        </div>
        <span className={styles.liveLabel}>
          <span aria-hidden="true" />
          Live data
        </span>
      </div>

      <div className={styles.stats} role="group" aria-label="Today's business performance">
        <Stat
          icon={CircleDollarSign}
          label="Paid today"
          value={formatCedis(stats.paidTodayPesewas)}
          hint="Before Stallo and Paystack fees"
          featured
        />
        <Stat icon={ShoppingBag} label="Orders today" value={String(stats.ordersToday)} hint="Placed on WhatsApp" />
        <Stat icon={Clock} label="Awaiting payment" value={String(stats.awaitingPayment)} hint="Payment link sent" />
        <Stat icon={Truck} label="To deliver" value={String(stats.toDeliver)} hint="Paid, not sent out yet" />
      </div>

      <TrackerPanel />

      <div className={styles.columns}>
        <Card
          title="Recent orders"
          description="The latest orders from your shop."
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
                  <ButtonLink to="/app/products" variant="primary" icon={<Package size={17} />}>
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

        <Card
          title="Needs attention"
          description="Items that need your review."
          actions={overview.attentionCount > 0 ? <span className={styles.attentionCount}>{overview.attentionCount}</span> : undefined}
          flush
        >
          {overview.attention.length === 0 ? (
            <div className={styles.allClear}>
              <span className={styles.allClearIcon}>
                <CircleCheck size={19} />
              </span>
              <div>
                <strong>You’re all caught up</strong>
                <p>Messages and orders needing a review will show up here.</p>
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
