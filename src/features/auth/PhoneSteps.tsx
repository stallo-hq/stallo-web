import type { FormEvent, ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { CodeInput } from '../../components/ui/CodeInput'
import { Field } from '../../components/ui/Field'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './auth.module.css'
import type { PhoneVerification } from './usePhoneVerification'

/** Step 1: the phone number. `onSubmit` decides what happens (e.g. check for an existing account first). */
export function PhoneStep({
  v,
  onSubmit,
  submitLabel = 'Send code',
  locked,
  extra,
}: {
  v: PhoneVerification
  onSubmit: () => void
  submitLabel?: string
  /** Show the number but don't let it change (confirming a known number). */
  locked?: boolean
  extra?: ReactNode
}) {
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }
  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <Field
        label="Phone number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="024 123 4567"
        value={v.phoneInput}
        onChange={(e) => v.setPhoneInput(e.target.value)}
        readOnly={locked}
        error={v.error}
        hint="We’ll text you a 6-digit code to confirm it’s yours."
        autoFocus={!locked}
      />
      {extra}
      <Button type="submit" variant="dark" size="lg" block loading={v.busy}>
        {submitLabel}
      </Button>
    </form>
  )
}

/** Step 2: the code from the SMS. Submits by itself once 6 digits are in. */
export function CodeStep({ v, onVerified }: { v: PhoneVerification; onVerified?: (token: string) => void }) {
  async function check(value?: string) {
    const token = await v.verify(value)
    if (token) onVerified?.(token)
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void check()
      }}
      noValidate
      className={styles.form}
    >
      <p className={styles.sentTo}>
        We sent a code to <strong>{v.phone ? formatGhanaPhone(v.phone) : ''}</strong>.{' '}
        <button type="button" className={styles.inlineLink} onClick={v.changeNumber}>
          Change number
        </button>
      </p>
      {v.testMode && <p className={styles.testNote}>Test mode is on: the code is 123456. No SMS is sent.</p>}
      <CodeInput
        value={v.code}
        onChange={(value) => {
          v.setCode(value)
          if (v.error) v.setError(null)
        }}
        onComplete={(value) => void check(value)}
        invalid={Boolean(v.error)}
        disabled={v.busy}
      />
      {v.error && (
        <p className={styles.error} role="alert">
          {v.error}
        </p>
      )}
      <Button type="submit" variant="dark" size="lg" block loading={v.busy}>
        Continue
      </Button>
      <p className={styles.resend}>
        Didn’t get it?{' '}
        {v.resendIn > 0 ? (
          <span>Send again in {v.resendIn}s</span>
        ) : (
          <button type="button" className={styles.inlineLink} onClick={() => void v.resend()} disabled={v.busy}>
            Send a new code
          </button>
        )}
      </p>
    </form>
  )
}
