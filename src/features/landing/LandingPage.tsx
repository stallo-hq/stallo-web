import { useQuery } from 'convex/react'
import { ArrowRight, Menu, Plus, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../../../convex/_generated/api'
import { Logo } from '../../components/Logo'
import { ButtonLink } from '../../components/ui/Button'
import { formatFee } from '../../lib/money'
import styles from './LandingPage.module.css'
import { ChatMock, DashboardMock, PayMock, PinMock, RiderSmsMock } from './visuals'

const YEAR = new Date().getFullYear()

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'Questions' },
]

function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Logo />
        <nav className={styles.navLinks} aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className={styles.navActions}>
          <Link to="/signin" className={styles.signIn}>
            Sign in
          </Link>
          <ButtonLink to="/signup" variant="primary">
            Create account
          </ButtonLink>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className={styles.mobileMenu} aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
          <Link to="/signin">Sign in</Link>
        </nav>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Stop copying orders out of WhatsApp.</h1>
        <p className={styles.heroLead}>
          Customers keep messaging your number the way they do now. Stallo reads each order, replies with the total,
          sends a Paystack link for MoMo or card, and gives your rider a code to confirm the drop-off.
        </p>
        <div className={styles.heroActions}>
          <ButtonLink to="/signup" variant="primary" size="lg">
            Create your account <ArrowRight size={18} />
          </ButtonLink>
          <a href="#how" className={styles.textLink}>
            Follow one order through
          </a>
        </div>
      </div>
      <div className={styles.heroVisual}>
        <ChatMock />
      </div>
    </section>
  )
}

function Moment({ time, title, children, visual }: { time: string; title: string; children: ReactNode; visual?: ReactNode }) {
  return (
    <li className={styles.moment}>
      <time className={styles.momentTime}>{time}</time>
      <div className={styles.momentText}>
        <h3>{title}</h3>
        {children}
      </div>
      {visual && <div className={styles.momentVisual}>{visual}</div>}
    </li>
  )
}

function OneOrder() {
  return (
    <section id="how" className={styles.section}>
      <h2 className={styles.sectionTitle}>One order at Ama’s Kitchen, Tuesday lunchtime</h2>
      <p className={styles.sectionText}>
        Ama sells food from her kitchen in Osu. This is what happened to order 1042 while she was at the stove.
      </p>
      <ol className={styles.timeline}>
        <Moment time="12:41" title="Efua orders in her own words">
          <p>
            “Abeg 2 jollof with chicken and 1 kelewele.” English, Twi, Pidgin or a mix of all three. Stallo matches it
            to Ama’s menu, takes the prices from her list, and asks for anything missing, like the address.
          </p>
        </Moment>
        <Moment time="12:42" title="She pays before anything is cooked" visual={<PayMock />}>
          <p>
            Efua replies YES and gets a Paystack link. She pays with MTN MoMo. The money goes to Ama’s own MoMo or bank
            account, and the order shows as paid on Ama’s dashboard. Customers who would rather pay cash on delivery can
            do that too.
          </p>
        </Moment>
        <Moment time="13:05" title="Kojo gets the job by SMS" visual={<RiderSmsMock />}>
          <p>
            Ama types her rider’s name and number. Kojo gets the address and a link to a page with the map and a call
            button. He doesn’t install anything. Efua gets a 4-digit delivery code.
          </p>
        </Moment>
        <Moment time="13:18" title="The code closes the order" visual={<PinMock />}>
          <p>
            At the gate, Efua reads her code to Kojo and he enters it. Ama sees “Delivered” without phoning anyone. If
            nobody is home, Kojo marks it failed and it waits for Ama under Needs attention.
          </p>
        </Moment>
      </ol>
    </section>
  )
}

function Dashboard() {
  return (
    <section className={styles.section}>
      <div className={styles.split}>
        <div>
          <h2 className={styles.sectionTitle}>Your day on one screen</h2>
          <p className={styles.sectionText}>
            Orders, money in and deliveries still out, updated as they happen. Anything Stallo wasn’t sure about sits at
            the top until you deal with it. Works on your phone.
          </p>
        </div>
        <div className={styles.dashVisual}>
          <DashboardMock />
        </div>
      </div>
    </section>
  )
}

const LIMITS = [
  {
    title: 'It never sets a price',
    text: 'Every amount comes from the product list you typed in. If an item isn’t on it, Stallo asks you.',
  },
  {
    title: 'It never messages first',
    text: 'Stallo only replies to people who wrote to you. No broadcasts, no promotions from your number.',
  },
  {
    title: 'It steps back when you type',
    text: 'Reply to a customer from your own phone and Stallo stays out of that chat for the next three hours.',
  },
]

function Limits() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>What it won’t do</h2>
      <div className={styles.limits}>
        {LIMITS.map((l) => (
          <div key={l.title}>
            <h3>{l.title}</h3>
            <p>{l.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const NEEDS = [
  'A Ghana mobile number for your account',
  'The phone your business WhatsApp is on, to scan a QR code',
  'Your products and prices',
  'A MoMo or bank account for payouts',
]

function Pricing() {
  const pricing = useQuery(api.site.pricing)
  const fee = pricing ? formatFee(pricing) : null
  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.pricing}>
        <div>
          <h2 className={styles.sectionTitle}>No monthly fee</h2>
          <p className={styles.sectionText}>
            {fee ? (
              <>
                Stallo takes <strong>{fee}</strong> from each paid order, nothing else.
              </>
            ) : (
              <>Stallo takes a small fee from each paid order, shown in your dashboard before you go live.</>
            )}{' '}
            Paystack’s own processing fee applies to each payment. Cancel any time.
          </p>
          <div className={styles.pricingAction}>
            <ButtonLink to="/signup" variant="primary" size="lg">
              Create your account
            </ButtonLink>
          </div>
        </div>
        <div className={styles.needs}>
          <h3>What you need to start</h3>
          <ul>
            {NEEDS.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: 'Do I need a new phone number?',
    a: 'No. You link the WhatsApp you already use by scanning a QR code, the same way you open WhatsApp Web. You can still read and reply from your phone.',
  },
  {
    q: 'How do customers pay?',
    a: 'With mobile money or card through a Paystack link sent in the chat, or in cash to the rider if you allow it. Paystack pays out to your own MoMo or bank account.',
  },
  {
    q: 'What if Stallo doesn’t understand a message?',
    a: 'It asks the customer a follow-up question. If it is still unsure, it tells the customer you will reply and puts the chat under Needs attention.',
  },
  {
    q: 'Does my rider need a smartphone?',
    a: 'The job comes by SMS, so any phone gets the address. To enter the delivery code they open a link, or they can send the code back by WhatsApp.',
  },
  {
    q: 'How do I hear about new orders?',
    a: 'The dashboard updates live. You also get an SMS when an order is paid or something needs you, and a short summary at the end of the day.',
  },
]

function Faq() {
  return (
    <section id="faq" className={styles.section}>
      <h2 className={styles.sectionTitle}>Questions</h2>
      <div className={styles.faq}>
        {FAQS.map((f) => (
          <details key={f.q} className={styles.faqItem}>
            <summary>
              {f.q}
              <Plus size={20} />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.closing}>
        <p>Set it up before your next order comes in.</p>
        <ButtonLink to="/signup" variant="primary" size="lg">
          Create your account <ArrowRight size={18} />
        </ButtonLink>
      </div>
      <div className={styles.footerInner}>
        <div>
          <Logo />
          <p className={styles.footerText}>WhatsApp orders, payments and deliveries for small sellers in Ghana.</p>
        </div>
        <nav className={styles.footerLinks} aria-label="Footer">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
          <Link to="/signin">Sign in</Link>
          <Link to="/signup">Create account</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </div>
      <p className={styles.copyright}>© {YEAR} Stallo</p>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className={styles.page}>
      <Nav />
      <main>
        <Hero />
        <OneOrder />
        <Dashboard />
        <Limits />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </div>
  )
}
