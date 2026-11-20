import { Check, CheckCheck, CreditCard, Lock, MapPin, Package, Phone, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { LogoMark } from '../../components/Logo'
import styles from './visuals.module.css'

/*
 * Product visuals for the marketing page, drawn in HTML so they stay sharp,
 * load instantly and match the real product. Sample data only.
 */

function Bubble({ from, children, time }: { from: 'customer' | 'stallo'; children: ReactNode; time: string }) {
  return (
    <div className={from === 'customer' ? styles.inbound : styles.outbound}>
      {children}
      <span className={styles.time}>
        {time}
        {from === 'stallo' && <CheckCheck size={13} />}
      </span>
    </div>
  )
}

/** A WhatsApp-style conversation where Stallo takes an order. */
export function ChatMock() {
  return (
    <div className={styles.phone}>
      <div className={styles.chatHeader}>
        <span className={styles.avatar}>AK</span>
        <div>
          <strong>Ama’s Kitchen</strong>
          <span>online</span>
        </div>
      </div>
      <div className={styles.chat}>
        <Bubble from="customer" time="12:41">
          Hello, abeg 2 jollof with chicken and 1 kelewele. Deliver to East Legon, near the A&amp;C mall
        </Bubble>
        <Bubble from="stallo" time="12:41">
          <strong>Your order</strong>
          <span className={styles.line}>2 × Jollof with chicken · GH₵ 130.00</span>
          <span className={styles.line}>1 × Kelewele · GH₵ 15.00</span>
          <span className={styles.total}>Total GH₵ 145.00 to East Legon</span>
          Reply YES to confirm.
        </Bubble>
        <Bubble from="customer" time="12:42">
          Yes
        </Bubble>
        <Bubble from="stallo" time="12:42">
          Pay with MoMo or card here:
          <span className={styles.link}>
            <Lock size={12} /> paystack.com/pay/ak-1042
          </span>
        </Bubble>
        <div className={styles.system}>
          <Check size={13} /> Paid · GH₵ 145.00
        </div>
      </div>
    </div>
  )
}

const rows = [
  { name: 'Kwame A.', items: '2 × Waakye special', total: 'GH₵ 90.00', status: 'Paid', tone: 'green' },
  { name: 'Efua M.', items: '1 × Jollof with chicken', total: 'GH₵ 65.00', status: 'Out for delivery', tone: 'blue' },
  { name: 'Yaw O.', items: '3 × Kelewele', total: 'GH₵ 45.00', status: 'Awaiting payment', tone: 'amber' },
  { name: 'Akosua B.', items: '2 × Fried rice', total: 'GH₵ 120.00', status: 'Delivered', tone: 'gray' },
] as const

/** A small version of the seller dashboard. */
export function DashboardMock() {
  return (
    <div className={styles.dash}>
      <div className={styles.dashTop}>
        <LogoMark size={20} />
        <span>Overview</span>
        <span className={styles.dashDate}>Today</span>
      </div>
      <div className={styles.stats}>
        <div>
          <span>Orders</span>
          <strong>24</strong>
        </div>
        <div>
          <span>Paid</span>
          <strong>GH₵ 2,340</strong>
        </div>
        <div>
          <span>To deliver</span>
          <strong>6</strong>
        </div>
      </div>
      <div className={styles.table}>
        {rows.map((r) => (
          <div key={r.name} className={styles.row}>
            <div>
              <strong>{r.name}</strong>
              <span>{r.items}</span>
            </div>
            <span className={styles.amount}>{r.total}</span>
            <span className={styles.pill} data-tone={r.tone}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The payment page a customer sees. */
export function PayMock() {
  return (
    <div className={styles.card}>
      <div className={styles.payHead}>
        <span className={styles.avatar}>AK</span>
        <div>
          <strong>Ama’s Kitchen</strong>
          <span>Order #1042</span>
        </div>
      </div>
      <div className={styles.payAmount}>GH₵ 145.00</div>
      <div className={styles.methods}>
        <div className={styles.method} data-active="true">
          <Phone size={16} /> Mobile money
          <Check size={16} className={styles.methodCheck} />
        </div>
        <div className={styles.method}>
          <CreditCard size={16} /> Card
        </div>
      </div>
      <div className={styles.payButton}>Pay GH₵ 145.00</div>
      <p className={styles.secure}>
        <ShieldCheck size={14} /> Secured by Paystack
      </p>
    </div>
  )
}

/** Delivery: the rider confirms the customer's PIN. */
export function PinMock() {
  return (
    <div className={styles.card}>
      <div className={styles.payHead}>
        <span className={styles.iconTile}>
          <Package size={18} />
        </span>
        <div>
          <strong>Delivery for Efua M.</strong>
          <span>
            <MapPin size={12} /> Osu, Oxford Street
          </span>
        </div>
      </div>
      <p className={styles.pinLabel}>Ask the customer for their 4-digit PIN</p>
      <div className={styles.pin}>
        {['4', '8', '1', '7'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className={styles.delivered}>
        <Check size={16} /> Delivered at 13:18
      </div>
    </div>
  )
}
