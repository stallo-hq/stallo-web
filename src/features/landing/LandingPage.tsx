import { useQuery } from 'convex/react'
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  CreditCard,
  Languages,
  Menu,
  MessageCircle,
  Plus,
  Smartphone,
  Truck,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../../../convex/_generated/api'
import { Logo } from '../../components/Logo'
import { ButtonLink } from '../../components/ui/Button'
import { formatFee } from '../../lib/money'
import styles from './LandingPage.module.css'
import { ChatMock, DashboardMock, PayMock, PinMock } from './visuals'

const YEAR = new Date().getFullYear()

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

function Nav() {
  const [open, setOpen] = useState(false)
  const [activeHref, setActiveHref] = useState<string>()

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('#features, #how, #pricing, #faq'))
    let frame: number | undefined

    const updateActive = () => {
      const activationLine = Math.min(Math.max(window.innerHeight * 0.4, 150), 320)
      let current: string | undefined
      for (const section of sections) {
        if (section.getBoundingClientRect().top > activationLine) break
        current = `#${section.id}`
      }
      setActiveHref(current)
    }

    const onScroll = () => {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame(() => {
        frame = undefined
        updateActive()
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    updateActive()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Logo />
        <nav className={styles.navLinks} aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className={activeHref === n.href ? styles.navActive : undefined}
              aria-current={activeHref === n.href ? 'location' : undefined}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className={styles.navActions}>
          <Link to="/signin" className={styles.signIn}>
            Sign in
          </Link>
          <ButtonLink to="/signup" variant="primary">
            Start selling
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
            <a
              key={n.href}
              href={n.href}
              className={activeHref === n.href ? styles.navActive : undefined}
              aria-current={activeHref === n.href ? 'location' : undefined}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </a>
          ))}
          <Link to="/signin">Sign in</Link>
        </nav>
      )}
    </header>
  )
}

function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 640)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      className={styles.backToTop}
      aria-label="Back to top"
      onClick={() => {
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        window.scrollTo({ top: 0, behavior })
      }}
    >
      <ArrowUp size={18} />
      <span>Back to top</span>
    </button>
  )
}

function Hero() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow} data-reveal>
        <span className={styles.dot} /> Made for sellers in Ghana
      </p>
      <h1 className={styles.heroTitle} data-reveal>
        Your WhatsApp,
        <br />
        now a full shop.
      </h1>
      <p className={styles.heroText} data-reveal>
        Customers order in the chat they already use. Stallo reads the order, sends a MoMo or card payment link, and
        tracks every delivery, so you can sell more without typing more.
      </p>
      <div className={styles.heroActions} data-reveal>
        <ButtonLink to="/signup" variant="primary" size="lg">
          Start selling free <ArrowRight size={18} />
        </ButtonLink>
        <a href="#how" className={styles.textLink}>
          See how it works
        </a>
      </div>
      <p className={styles.heroNote} data-reveal>
        No monthly fee · Set up in minutes · Payments by Paystack
      </p>

      <div className={styles.showcase} data-reveal>
        <div className={styles.showcaseChat}>
          <ChatMock />
        </div>
        <div className={styles.showcaseDash}>
          <DashboardMock />
        </div>
      </div>
    </section>
  )
}

const PAYMENT_METHODS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Visa', 'Mastercard', 'Bank transfer']

function Methods() {
  return (
    <section className={styles.methods} aria-label="Ways your customers can pay" data-reveal>
      <p>Your customers pay the way they like</p>
      <ul>
        {PAYMENT_METHODS.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </section>
  )
}

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Orders from plain chat',
    text: 'Customers type the way they talk, in English, Twi or Pidgin. Stallo picks out the items, quantities and address.',
  },
  {
    icon: CreditCard,
    title: 'Paid before you pack',
    text: 'Every confirmed order gets a secure Paystack link. Money goes straight to your MoMo or bank account.',
  },
  {
    icon: Truck,
    title: 'Deliveries with a PIN',
    text: 'The customer gets a 4-digit PIN. Your rider enters it at the door, so you know exactly when it arrived.',
  },
  {
    icon: Bell,
    title: 'Nothing slips through',
    text: 'Unclear messages, failed payments and stock problems wait for you under Needs attention.',
  },
]

function Features() {
  return (
    <section id="features" className={styles.section}>
      <h2 className={styles.sectionTitle} data-reveal>
        What makes Stallo different
      </h2>
      <div className={styles.featureGrid}>
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <article key={title} className={styles.feature} data-reveal>
            <span className={styles.featureIcon}>
              <Icon size={22} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Story({
  title,
  points,
  visual,
  flip,
}: {
  title: ReactNode
  points: string[]
  visual: ReactNode
  flip?: boolean
}) {
  return (
    <section className={styles.story} data-flip={flip || undefined}>
      <div className={styles.storyText} data-reveal>
        <h2 className={styles.storyTitle}>{title}</h2>
        <ul className={styles.points}>
          {points.map((p) => (
            <li key={p}>
              <span aria-hidden="true">✱</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.storyVisual} data-reveal>
        {visual}
      </div>
    </section>
  )
}

function Stories() {
  return (
    <div className={styles.stories}>
      <Story
        title={
          <>
            Orders taken,
            <br />
            even while you sleep
          </>
        }
        points={[
          'Replies in seconds, any time of day',
          'Matches what customers ask for to your product list',
          'Asks for anything missing, then confirms the total',
          'Prices always come from your list, never guessed',
        ]}
        visual={<ChatMock />}
      />
      <Story
        flip
        title={
          <>
            Get paid before
            <br />
            it leaves your hands
          </>
        }
        points={[
          'MoMo and card through Paystack',
          'Payouts to your mobile money or bank account',
          'You see each payment the moment it lands',
          'Refunds from your dashboard in two clicks',
        ]}
        visual={<PayMock />}
      />
      <Story
        title={
          <>
            Deliveries you
            <br />
            can actually trust
          </>
        }
        points={[
          'Add your rider’s name and number when you send an order out',
          'The rider gets the address and a map link on WhatsApp',
          'The customer’s PIN confirms the handover',
          'Failed delivery or return? One tap and it’s recorded',
        ]}
        visual={<PinMock />}
      />
    </div>
  )
}

const STEPS = [
  { title: 'Create your account', text: 'Sign up with your phone number. We confirm it with a code by SMS.' },
  { title: 'Add what you sell', text: 'Names, prices and how many you have. Change them any time.' },
  { title: 'Connect WhatsApp and payouts', text: 'Link your business number and where your money should go.' },
  { title: 'Share your number', text: 'Customers message you as usual. Stallo takes it from there.' },
]

function HowItWorks() {
  return (
    <section id="how" className={styles.section}>
      <h2 className={styles.sectionTitle} data-reveal>
        Up and running this afternoon
      </h2>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step} data-reveal>
            <span className={styles.stepNumber}>{String(i + 1).padStart(2, '0')}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const INCLUDED = [
  'Unlimited products and customers',
  'Order taking in English, Twi and Pidgin',
  'Paystack payment links (MoMo and card)',
  'Delivery PINs and a rider page',
  'Daily summary on WhatsApp',
  'Needs attention inbox',
]

function Pricing() {
  const pricing = useQuery(api.site.pricing)
  const fee = pricing ? formatFee(pricing) : null
  return (
    <section id="pricing" className={styles.section}>
      <h2 className={styles.sectionTitle} data-reveal>
        Simple pricing. You only pay when you get paid.
      </h2>
      <div className={styles.pricing} data-reveal>
        <div className={styles.priceMain}>
          <p className={styles.planName}>Stallo</p>
          <p className={styles.price}>
            GH₵ 0<span>/ month</span>
          </p>
          <p className={styles.priceFee}>
            {fee ? (
              <>
                Plus <strong>{fee}</strong> on each paid order.
              </>
            ) : (
              <>A small fee on each paid order, shown in your dashboard before you go live.</>
            )}{' '}
            Paystack’s own processing fee applies to each payment.
          </p>
          <ButtonLink to="/signup" variant="primary" size="lg" block>
            Start selling free
          </ButtonLink>
        </div>
        <ul className={styles.included}>
          {INCLUDED.map((i) => (
            <li key={i}>
              <Check size={18} /> {i}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: 'Do I need a new phone number?',
    a: 'No. Stallo works through the official WhatsApp Business Platform. In most cases you can keep your current business number. If not, we help you set up a dedicated one.',
  },
  {
    q: 'How do customers pay?',
    a: 'They get a secure Paystack link in the chat and pay with mobile money or card. The money goes to your own MoMo or bank account.',
  },
  {
    q: 'What if Stallo doesn’t understand a message?',
    a: 'It never guesses. It asks the customer a follow-up question, and if it is still unsure the message comes to you under Needs attention.',
  },
  {
    q: 'Can customers write in Twi or Pidgin?',
    a: 'Yes. Customers can mix English, Twi and Pidgin in the same message, the way people actually type.',
  },
  {
    q: 'What does a rider need?',
    a: 'Just WhatsApp. They get the order details and a link to confirm the delivery with the customer’s PIN. No app to install.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. There is no monthly fee and no contract. You pay a small fee only on orders that are paid.',
  },
]

function Faq() {
  return (
    <section id="faq" className={styles.section}>
      <h2 className={styles.sectionTitle} data-reveal>
        Questions sellers ask
      </h2>
      <div className={styles.faq} data-reveal>
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

function Highlights() {
  const items = [
    { icon: Smartphone, text: 'Works on any phone. Nothing for customers to install.' },
    { icon: Languages, text: 'Understands English, Twi and Pidgin.' },
    { icon: CreditCard, text: 'Money goes to your own account, not ours.' },
  ]
  return (
    <section className={styles.highlights}>
      {items.map(({ icon: Icon, text }) => (
        <p key={text} data-reveal>
          <Icon size={20} /> {text}
        </p>
      ))}
    </section>
  )
}

function Banner() {
  return (
    <section className={styles.banner} data-reveal>
      <h2>Got something to sell? Let your chat do the work.</h2>
      <ButtonLink to="/signup" variant="dark" size="lg">
        Start selling free <ArrowRight size={18} />
      </ButtonLink>
    </section>
  )
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner} data-reveal>
        <div>
          <Logo />
          <p className={styles.footerText}>WhatsApp selling, payments and delivery for small businesses in Ghana.</p>
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
      <p className={styles.copyright} data-reveal>
        © {YEAR} Stallo
      </p>
    </footer>
  )
}

export function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page) return

    const root = document.documentElement
    root.classList.add(styles.smoothScroll)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      return () => root.classList.remove(styles.smoothScroll)
    }

    const targets = Array.from(page.querySelectorAll<HTMLElement>('[data-reveal]'))
    page.classList.add(styles.revealReady)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add(styles.revealed)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    )

    for (const target of targets) {
      const siblings = Array.from(target.parentElement?.children ?? []).filter((sibling) =>
        sibling.hasAttribute('data-reveal'),
      )
      const revealIndex = siblings.indexOf(target)
      target.style.setProperty('--reveal-delay', `${Math.min(revealIndex * 80, 240)}ms`)
      observer.observe(target)
    }

    return () => {
      observer.disconnect()
      root.classList.remove(styles.smoothScroll)
      page.classList.remove(styles.revealReady)
      for (const target of targets) {
        target.classList.remove(styles.revealed)
        target.style.removeProperty('--reveal-delay')
      }
    }
  }, [])

  return (
    <div ref={pageRef} className={styles.page}>
      <Nav />
      <main>
        <Hero />
        <Methods />
        <Features />
        <Stories />
        <section className={styles.dashSection}>
          <h2 className={styles.sectionTitle} data-reveal>
            One dashboard for the whole day
          </h2>
          <p className={styles.sectionText} data-reveal>
            Today’s orders, money in, deliveries out and anything that needs you. Updated live, on your phone or laptop.
          </p>
          <div className={styles.dashVisual} data-reveal>
            <DashboardMock />
          </div>
        </section>
        <HowItWorks />
        <Highlights />
        <Pricing />
        <Faq />
        <Banner />
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}
