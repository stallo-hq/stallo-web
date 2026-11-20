import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import styles from './Card.module.css'

/** White panel with a border. Optional header with title, description and actions. */
export function Card({
  title,
  description,
  actions,
  flush,
  className,
  children,
  ...rest
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** No inner padding, for lists and tables that run edge to edge. */
  flush?: boolean
} & Omit<HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cx(styles.card, className)} {...rest}>
      {(title || actions) && (
        <header className={styles.header}>
          <div className={styles.heading}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : styles.body}>{children}</div>
    </section>
  )
}
