import { cx } from '../../lib/cx'
import styles from './Segmented.module.css'

type Option<T extends string> = { value: T; label: string; count?: number }

/** A row of mutually exclusive filters (radio group). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<Option<T>>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx(styles.option, o.value === value && styles.selected)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className={styles.count}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
