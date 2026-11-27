import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'
import { ChatMock } from '../landing/visuals'
import styles from './AuthLayout.module.css'

const YEAR = new Date().getFullYear()

/**
 * Signed-out screens, in the dashboard's dark theme so signing in feels like the
 * same product: the form on the left, the product on the right (hidden on phones).
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className={styles.layout} data-dashboard-theme="landing">
      <div className={styles.formSide}>
        <div className={styles.top}>
          <Logo tone="light" />
        </div>
        <main className={styles.form}>
          <div className={styles.panel}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            <div className={styles.body}>{children}</div>
          </div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </main>
        <p className={styles.legal}>© {YEAR} Stallo</p>
      </div>
      <aside className={styles.brandSide} aria-hidden="true">
        <div className={styles.brandInner}>
          <p className={styles.brandTitle}>Customers order in chat. You get paid.</p>
          <ChatMock />
        </div>
      </aside>
    </div>
  )
}
