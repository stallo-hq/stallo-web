import { AlertTriangle, Bike, Check, ExternalLink, MapPin, MessageCircle, Phone, RotateCcw, Send, Undo2, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import type { Id } from '../../../convex/_generated/dataModel'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import { PageSpinner } from '../../components/ui/Spinner'
import { useNow } from '../../hooks/useNow'
import { formatShortDateTime } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatCedis } from '../../lib/money'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './OrderDetailPage.module.css'
import { Switch } from '../../components/ui/Switch'
import { parseCedis } from '../../lib/money'
import { CASH_STATUS, DELIVERY_STATUS, ORDER_STATUS, PAYMENT_STATUS, orderStatusLabel } from './orderStatus'
import { useOrder, type OrderDetail } from './useOrder'

type Pending = 'dispatch' | 'fail' | 'return' | 'cancel' | 'refund' | null

export function OrderDetailPage() {
  const { orderId } = useParams() as { orderId: Id<'orders'> }
  const actions = useOrder(orderId)
  const { order } = actions
  const [open, setOpen] = useState<Pending>(null)

  if (order === undefined) return <PageSpinner />
  if (order === null) {
    return (
      <>
        <PageHeader title="Order" back={{ to: '/app/orders', label: 'Orders' }} />
        <Card>
          <EmptyState title="Order not found" action={<ButtonLink to="/app/orders">Back to orders</ButtonLink>}>
            It may have been removed, or it belongs to another account.
          </EmptyState>
        </Card>
      </>
    )
  }

  const status = orderStatusLabel(order.status, order.paymentMethod)
  const cash = order.paymentMethod === 'cash'
  const canDispatch = order.status === 'paid' || order.status === 'delivery_failed'
  const canCancel = ['draft', 'awaiting_confirmation', 'awaiting_payment', 'paid'].includes(order.status)
  const canRefund =
    order.paymentStatus === 'paid' && ['delivered', 'delivery_failed', 'returned', 'cancelled'].includes(order.status)

  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work()
      toast.success(done)
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/app/orders', label: 'Orders' }}
        title={
          <span className={styles.title}>
            Order {order.label} <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        description={`${order.customer.name ?? formatGhanaPhone(order.customer.phone)} · ${formatShortDateTime(order.createdAt)}`}
        actions={
          <>
            {canDispatch && (
              <Button variant="dark" icon={<Bike size={17} />} onClick={() => setOpen('dispatch')}>
                {order.status === 'delivery_failed' ? 'Send again' : 'Dispatch'}
              </Button>
            )}
            {order.status === 'dispatched' && (
              <Button variant="secondary" icon={<XCircle size={17} />} onClick={() => setOpen('fail')}>
                Mark failed
              </Button>
            )}
            {order.status === 'delivery_failed' && (
              <Button variant="secondary" icon={<Undo2 size={17} />} onClick={() => setOpen('return')}>
                Mark returned
              </Button>
            )}
            {canRefund && (
              <Button variant="secondary" icon={<RotateCcw size={17} />} onClick={() => setOpen('refund')}>
                Refund
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" onClick={() => setOpen('cancel')}>
                Cancel order
              </Button>
            )}
          </>
        }
      />

      <NextStep order={order} onResend={() => run(() => actions.resendLink({ orderId }), 'Payment link sent again')} />
      {order.sellerHandlingUntil !== undefined && (
        <SellerHandling
          until={order.sellerHandlingUntil}
          onResume={() => run(() => actions.letStalloReply({ orderId }), 'Stallo will answer this customer again')}
        />
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          {order.attention.length > 0 && (
            <Card title="Needs attention" flush>
              <ul className={styles.attention}>
                {order.attention.map((a) => (
                  <li key={a._id}>
                    <AlertTriangle size={17} />
                    <span>{a.summary}</span>
                    <Button size="sm" variant="ghost" onClick={() => void run(() => actions.resolve({ id: a._id }), 'Marked as done')}>
                      Done
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Items" flush>
            <ul className={styles.items}>
              {order.items.map((item, i) => (
                <li key={i}>
                  <span className={styles.qty}>{item.qty} ×</span>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className="num">{formatCedis(item.unitPricePesewas * item.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className={styles.totals}>
              {order.deliveryFeePesewas > 0 && (
                <div>
                  <dt>Delivery</dt>
                  <dd className="num">{formatCedis(order.deliveryFeePesewas)}</dd>
                </div>
              )}
              <div>
                <dt>Customer pays</dt>
                <dd className="num">{formatCedis(order.totalPesewas)}</dd>
              </div>
              {cash && (
                <div>
                  <dt>{order.deliveryFeePesewas > 0 ? 'In cash to the rider (delivery fee paid online)' : 'In cash to the rider'}</dt>
                  <dd className="num">{formatCedis(order.cashDuePesewas)}</dd>
                </div>
              )}
              {order.feePesewas > 0 && (
                <div>
                  <dt>{cash ? 'Stallo fee (taken from your online payments)' : 'Stallo fee'}</dt>
                  <dd className="num">− {formatCedis(order.feePesewas)}</dd>
                </div>
              )}
              {order.feePesewas > 0 && (
                <div className={styles.strong}>
                  <dt>You receive (before Paystack’s fee)</dt>
                  <dd className="num">{formatCedis(order.totalPesewas - order.feePesewas)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="History">
            <ol className={styles.timeline}>
              {[...order.timeline].reverse().map((step, i) => (
                <li key={i}>
                  <span className={styles.dot} data-tone={ORDER_STATUS[step.status].tone} />
                  <div>
                    <strong>{ORDER_STATUS[step.status].label}</strong>
                    {step.note && <span>{step.note}</span>}
                  </div>
                  <time>{formatShortDateTime(step.at)}</time>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className={styles.side}>
          <Card title="Customer">
            <dl className={styles.facts}>
              {order.customer.name && (
                <div>
                  <dt>Name</dt>
                  <dd>{order.customer.name}</dd>
                </div>
              )}
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${order.customer.phone}`}>{formatGhanaPhone(order.customer.phone)}</a>
                </dd>
              </div>
              {order.recipient && (
                <div>
                  <dt>Receiver</dt>
                  <dd>
                    {order.recipient.name ?? 'Not named'}
                    {order.recipient.phone && (
                      <>
                        {' · '}
                        <a href={`tel:${order.recipient.phone}`}>{formatGhanaPhone(order.recipient.phone)}</a>
                      </>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>Deliver to</dt>
                <dd>{order.address ?? 'Not given yet'}</dd>
              </div>
              {order.digitalAddress && (
                <div>
                  <dt>Digital address</dt>
                  <dd>{order.digitalAddress}</dd>
                </div>
              )}
              {order.address && (
                <div>
                  <dt>Map</dt>
                  <dd>{order.hasPin ? 'Location pin shared' : order.digitalAddress ? 'From the digital address' : 'No pin shared: call to check the place'}</dd>
                </div>
              )}
            </dl>
            {order.outsideDeliveryArea && (
              <p className={styles.warning}>This address may be outside your delivery areas. Check with the customer before sending it out.</p>
            )}
            <div className={styles.links}>
              <ButtonLink size="sm" variant="secondary" to={`https://wa.me/${order.customer.phone.replace('+', '')}`} external icon={<Phone size={15} />}>
                WhatsApp
              </ButtonLink>
              {(order.mapsUrl || order.address) && (
                <ButtonLink
                  size="sm"
                  variant="secondary"
                  to={order.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address ?? '')}`}
                  external
                  icon={<MapPin size={15} />}
                >
                  Map
                </ButtonLink>
              )}
            </div>
          </Card>

          <Card title="Payment">
            <dl className={styles.facts}>
              {order.paymentMethod && (
                <div>
                  <dt>Method</dt>
                  <dd>{cash ? 'Cash on delivery' : 'Mobile money or card'}</dd>
                </div>
              )}
              {(!cash || order.deliveryFeePesewas > 0) && (
                <div>
                  <dt>{cash ? 'Delivery fee' : 'Status'}</dt>
                  <dd>
                    <Badge tone={PAYMENT_STATUS[order.paymentStatus].tone}>{PAYMENT_STATUS[order.paymentStatus].label}</Badge>
                  </dd>
                </div>
              )}
              {cash && order.cashStatus && (
                <div>
                  <dt>Cash {formatCedis(order.cashDuePesewas)}</dt>
                  <dd>
                    <Badge tone={CASH_STATUS[order.cashStatus].tone}>{CASH_STATUS[order.cashStatus].label}</Badge>
                  </dd>
                </div>
              )}
              {order.payment && (
                <div>
                  <dt>Reference</dt>
                  <dd className={styles.mono}>{order.payment.reference}</dd>
                </div>
              )}
            </dl>
            {order.paymentUrl && (
              <ButtonLink size="sm" variant="secondary" to={order.paymentUrl} external icon={<ExternalLink size={15} />}>
                Open payment link
              </ButtonLink>
            )}
            {cash && order.cashStatus === 'with_rider' && (
              <Button
                size="sm"
                variant="dark"
                icon={<Check size={15} />}
                onClick={() => void run(() => actions.markCashReceived({ orderId }), 'Cash marked as received').catch(() => undefined)}
              >
                Cash received from rider
              </Button>
            )}
          </Card>

          <Card title="Delivery">
            {order.delivery ? (
              <dl className={styles.facts}>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <Badge tone={DELIVERY_STATUS[order.delivery.status].tone}>{DELIVERY_STATUS[order.delivery.status].label}</Badge>
                  </dd>
                </div>
                <div>
                  <dt>Rider</dt>
                  <dd>{order.delivery.riderName}</dd>
                </div>
                <div>
                  <dt>Rider phone</dt>
                  <dd>
                    <a href={`tel:${order.delivery.riderPhone}`}>{formatGhanaPhone(order.delivery.riderPhone)}</a>
                  </dd>
                </div>
                {order.delivery.riderFeePesewas !== undefined && (
                  <div>
                    <dt>Rider’s fee</dt>
                    <dd>
                      {formatCedis(order.delivery.riderFeePesewas)} · {order.delivery.riderFeeFromCash ? 'kept from the cash' : 'you pay them'}
                    </dd>
                  </div>
                )}
                {order.delivery.notes && (
                  <div>
                    <dt>Note</dt>
                    <dd>{order.delivery.notes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className={styles.muted}>
                {order.status === 'paid'
                  ? 'Ready to go. Dispatch it to send the customer a delivery code and the rider the details.'
                  : 'You can dispatch the order once it is paid.'}
              </p>
            )}
          </Card>
        </div>
      </div>

      <DispatchDialog
        key={open === 'dispatch' ? 'open' : 'closed'}
        open={open === 'dispatch'}
        onOpenChange={(o) => setOpen(o ? 'dispatch' : null)}
        cashDuePesewas={cash ? order.cashDuePesewas : 0}
        onDispatch={async (rider) => {
          try {
            const { riderLink } = await actions.dispatch({ orderId, ...rider })
            toast.success('Dispatched. The customer has their code.', {
              description: 'The rider gets their link on WhatsApp. You can also send it yourself.',
              duration: 20000,
              action: { label: 'Copy rider link', onClick: () => void navigator.clipboard.writeText(riderLink) },
            })
          } catch (err) {
            toast.error(errorMessage(err))
            throw err
          }
        }}
      />
      <FailDialog
        key={open === 'fail' ? 'fail-open' : 'fail-closed'}
        open={open === 'fail'}
        onOpenChange={(o) => setOpen(o ? 'fail' : null)}
        onFail={(reason) => run(() => actions.markFailed({ orderId, reason }), 'Marked as failed')}
      />
      <ConfirmDialog
        open={open === 'return'}
        onOpenChange={(o) => setOpen(o ? 'return' : null)}
        title="Mark as returned?"
        description="Use this when the items are back with you. They go back into stock. You can refund the customer afterwards."
        confirmLabel="Mark returned"
        onConfirm={() => run(() => actions.markReturned({ orderId }), 'Marked as returned')}
      />
      <ConfirmDialog
        open={open === 'cancel'}
        onOpenChange={(o) => setOpen(o ? 'cancel' : null)}
        title={`Cancel order ${order.label}?`}
        description={
          order.paymentStatus === 'paid'
            ? `The customer has paid. Cancelling refunds ${formatCedis(order.totalPesewas)} to them through Paystack and tells them on WhatsApp.`
            : 'The customer will be told on WhatsApp. This can’t be undone.'
        }
        confirmLabel={order.paymentStatus === 'paid' ? 'Cancel and refund' : 'Cancel order'}
        destructive
        onConfirm={() => run(() => actions.cancel({ orderId }), 'Order cancelled')}
      />
      <ConfirmDialog
        open={open === 'refund'}
        onOpenChange={(o) => setOpen(o ? 'refund' : null)}
        title={`Refund ${formatCedis(order.totalPesewas)}?`}
        description="Paystack returns the full payment to the customer. It can take a few days to reach them. This can’t be undone."
        confirmLabel="Refund"
        destructive
        onConfirm={() => run(() => actions.refund({ orderId }), 'Refund started')}
      />
    </>
  )
}

/** One line telling the seller what happens next with this order. */
/** Shown while the seller is replying to this customer from their phone and Stallo is staying quiet. */
function SellerHandling({ until, onResume }: { until: number; onResume: () => Promise<unknown> }) {
  const now = useNow()
  const [busy, setBusy] = useState(false)
  if (until <= now) return null
  return (
    <div className={styles.handling}>
      <MessageCircle size={16} />
      <span>
        You replied to this customer from your phone, so Stallo won’t answer them until {formatShortDateTime(until, now)}. Every reply you
        send restarts this.
      </span>
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={() => {
          setBusy(true)
          void onResume()
            .catch(() => undefined)
            .finally(() => setBusy(false))
        }}
      >
        Let Stallo reply now
      </Button>
    </div>
  )
}

function NextStep({ order, onResend }: { order: OrderDetail; onResend: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false)
  const text: Partial<Record<OrderDetail['status'], string>> = {
    draft: 'The customer is still choosing. Stallo will ask them to confirm.',
    awaiting_confirmation: 'Waiting for the customer to confirm the order on WhatsApp.',
    awaiting_payment: order.paymentUrl
      ? 'Payment link sent. The order moves on as soon as the customer pays.'
      : 'The payment link hasn’t gone out yet.',
    paid:
      order.paymentMethod === 'cash'
        ? `Cash on delivery. Dispatch it when it’s ready; the rider collects ${formatCedis(order.cashDuePesewas)}.`
        : 'Paid. Dispatch it when it’s ready to go.',
    dispatched: 'With the rider. It’s marked delivered when the rider enters the customer’s code.',
    delivery_failed: 'Delivery didn’t happen. Send it again, or mark it returned.',
  }
  const message = text[order.status]
  if (!message) return null
  return (
    <div className={styles.next}>
      <Send size={16} />
      <span>{message}</span>
      {order.status === 'awaiting_payment' && !order.paymentUrl && (
        <Button
          size="sm"
          variant="dark"
          loading={busy}
          onClick={() => {
            setBusy(true)
            void onResend()
              .catch(() => undefined)
              .finally(() => setBusy(false))
          }}
        >
          Send payment link
        </Button>
      )}
    </div>
  )
}

type RiderDetails = { riderName: string; riderPhone: string; riderFeePesewas?: number; riderFeeFromCash?: boolean }

function DispatchDialog({
  open,
  onOpenChange,
  onDispatch,
  cashDuePesewas,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDispatch: (rider: RiderDetails) => Promise<unknown>
  /** For cash orders: what the rider collects. 0 otherwise. */
  cashDuePesewas: number
}) {
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  const [fee, setFee] = useState('')
  const [fromCash, setFromCash] = useState(false)
  const [feeError, setFeeError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const riderFeePesewas = fee.trim() === '' ? undefined : parseCedis(fee)
    if (riderFeePesewas === null) return setFeeError('Enter an amount, for example 15, or leave it empty.')
    if (fromCash && riderFeePesewas !== undefined && riderFeePesewas > cashDuePesewas) {
      return setFeeError('The fee can’t be more than the cash the rider collects.')
    }
    setFeeError(null)
    setBusy(true)
    try {
      await onDispatch({
        riderName,
        riderPhone,
        ...(riderFeePesewas !== undefined ? { riderFeePesewas, riderFeeFromCash: cashDuePesewas > 0 && fromCash } : {}),
      })
      onOpenChange(false)
    } catch {
      // The toast already explains what went wrong.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dispatch order"
      description="The customer gets a 4-digit delivery code on WhatsApp. The rider gets the address and a link to confirm delivery by SMS."
      onSubmit={(e) => void submit(e)}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" loading={busy} icon={<Check size={17} />}>
            Dispatch
          </Button>
        </>
      }
    >
      <Field label="Rider’s name" value={riderName} onChange={(e) => setRiderName(e.target.value)} autoComplete="off" />
      <Field
        label="Rider’s phone"
        type="tel"
        inputMode="tel"
        placeholder="024 123 4567"
        value={riderPhone}
        onChange={(e) => setRiderPhone(e.target.value)}
        hint="They’ll get the job on WhatsApp."
      />
      {cashDuePesewas > 0 && (
        <p className={styles.muted}>Cash on delivery: the rider collects {formatCedis(cashDuePesewas)} from the customer.</p>
      )}
      <Field
        label="Rider’s fee (optional)"
        prefix="GH₵"
        inputMode="decimal"
        placeholder="0.00"
        value={fee}
        onChange={(e) => setFee(e.target.value)}
        error={feeError ?? undefined}
        hint="What you agreed to pay them. Stallo only shows it to the rider; you settle it between you."
      />
      {cashDuePesewas > 0 && fee.trim() !== '' && (
        <Switch
          label="Rider keeps the fee from the cash"
          hint="Otherwise you pay them yourself."
          checked={fromCash}
          onCheckedChange={setFromCash}
        />
      )}
    </Dialog>
  )
}

function FailDialog({
  open,
  onOpenChange,
  onFail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFail: (reason: string) => Promise<unknown>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onFail(reason)
      onOpenChange(false)
    } catch {
      // Shown as a toast.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delivery failed"
      description="The customer is told and the order is kept so you can send it again or mark it returned."
      onSubmit={(e) => void submit(e)}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Mark failed
          </Button>
        </>
      }
    >
      <Field label="What happened?" placeholder="e.g. Customer not reachable" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Dialog>
  )
}
