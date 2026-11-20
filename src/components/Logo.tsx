import { Link } from 'react-router'
import styles from './Logo.module.css'

/** Stallo mark: a chat bubble with a tick (an order taken in chat). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 3C8.82 3 3 8.37 3 15c0 3.05 1.23 5.83 3.26 7.95L5 29l6.4-2.62A14.2 14.2 0 0 0 16 27c7.18 0 13-5.37 13-12S23.18 3 16 3Z"
        fill="var(--accent)"
      />
      <path d="m10.5 15.2 3.6 3.6 7.4-7.6" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ to = '/', tone = 'dark' }: { to?: string; tone?: 'dark' | 'light' }) {
  return (
    <Link to={to} className={styles.logo} data-tone={tone} aria-label="Stallo home">
      <LogoMark />
      <span className={styles.word}>stallo</span>
    </Link>
  )
}
