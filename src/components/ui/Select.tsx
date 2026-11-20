import { ChevronDown } from 'lucide-react'
import { useId, type SelectHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import fieldStyles from './Field.module.css'
import styles from './Select.module.css'

type SelectProps = {
  label: string
  hint?: string
  error?: string | null
  options: { value: string; label: string }[]
  placeholder?: string
} & SelectHTMLAttributes<HTMLSelectElement>

/** A native select that looks like Field. Native, so it works well on phones. */
export function Select({ label, hint, error, options, placeholder, className, id, ...select }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const note = error ?? hint
  return (
    <div className={cx(fieldStyles.field, className)}>
      <label className={fieldStyles.label} htmlFor={selectId}>
        {label}
      </label>
      <div className={cx(fieldStyles.box, styles.box, error && fieldStyles.invalid)}>
        <select id={selectId} className={cx(fieldStyles.input, styles.select)} aria-invalid={error ? true : undefined} {...select}>
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={17} className={styles.chevron} aria-hidden />
      </div>
      {note && <p className={cx(fieldStyles.note, error && fieldStyles.errorText)}>{note}</p>}
    </div>
  )
}
