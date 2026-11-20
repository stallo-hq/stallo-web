import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp'
import { cx } from '../../lib/cx'
import styles from './CodeInput.module.css'

/** Six boxes for an SMS code. Pastes and autofills ("one-time-code") work. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <OTPInput
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      pattern={REGEXP_ONLY_DIGITS}
      autoFocus
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label="6-digit code"
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
