import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp'
import { cx } from '../../lib/cx'
import styles from './CodeInput.module.css'

/** Boxes for a numeric code (6 for SMS codes, 4 for delivery codes). Pastes and autofills work. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
  length = 6,
  autoFocus = true,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  invalid?: boolean
  disabled?: boolean
  length?: number
  autoFocus?: boolean
}) {
  return (
    <OTPInput
      maxLength={length}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      pattern={REGEXP_ONLY_DIGITS}
      autoFocus={autoFocus}
      inputMode="numeric"
      autoComplete={length === 6 ? 'one-time-code' : 'off'}
      aria-label={`${length}-digit code`}
      containerClassName={styles.container}
      render={({ slots }) => (
        <>
          {slots.map((slot, i) => (
            <div key={i} className={cx(styles.slot, slot.isActive && styles.active, invalid && styles.invalid)}>
              {slot.char}
              {slot.hasFakeCaret && <span className={styles.caret} />}
            </div>
          ))}
        </>
      )}
    />
  )
}
