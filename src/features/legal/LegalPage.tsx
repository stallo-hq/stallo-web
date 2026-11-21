import { ArrowLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../../components/Logo'
import styles from './LegalPage.module.css'

export const CONTACT_EMAIL = 'mystallo@gmail.com'
export const LAST_UPDATED = '21 November 2026'
const YEAR = new Date().getFullYear()

/** Shared layout for the privacy policy and terms: dark, like the rest of the website. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Stallo`
    window.scrollTo(0, 0)
  }, [title])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo />
          <Link to="/" className={styles.back}>
            <ArrowLeft size={16} /> Back to Stallo
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <p className={styles.updated}>Last updated {LAST_UPDATED}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.intro}>{intro}</p>
        <div className={styles.body}>{children}</div>
        <p className={styles.contact}>
          Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </main>
      <footer className={styles.footer}>
        <span>© {YEAR} Stallo</span>
        <nav aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  )
}
