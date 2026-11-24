import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import styles from './Badge.module.css'

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray'

/** Small coloured status label. */
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx(styles.badge, styles[tone])}>{children}</span>
}
