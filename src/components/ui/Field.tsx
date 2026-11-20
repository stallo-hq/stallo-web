import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import styles from './Field.module.css'

type FieldProps = {
  label: string
  hint?: ReactNode
  error?: string | null
  /** Text or icon shown inside the box before the input, e.g. "+233" or "GH₵". */
  prefix?: ReactNode
  suffix?: ReactNode
  /** Light text on the dark marketing/auth surfaces. */
  tone?: 'light' | 'dark'
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>

/** Label, input, and a hint or error underneath. The one text field used everywhere. */
export function Field({ label, hint, error, prefix, suffix, tone = 'light', className, id, ...input }: FieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const noteId = `${inputId}-note`
  const note = error ?? hint
  return (
    <div className={cx(styles.field, tone === 'dark' && styles.dark, className)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={cx(styles.box, error && styles.invalid)}>
        {prefix && <span className={styles.affix}>{prefix}</span>}
        <input
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          {...input}
        />
        {suffix && <span className={styles.affix}>{suffix}</span>}
      </div>
      {note && (
        <p id={noteId} className={cx(styles.note, error && styles.errorText)} role={error ? 'alert' : undefined}>
          {note}
        </p>
      )}
    </div>
  )
}

/** Password field with a show/hide button. */
export function PasswordField(props: Omit<FieldProps, 'type' | 'suffix'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  )
}
