import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorMessage } from '../../lib/errors'
import { formatGhanaPhone } from '../../lib/phone'
import styles from './auth.module.css'
import { AuthLayout } from './AuthLayout'
import { CodeStep, PhoneStep } from './PhoneSteps'
import { SignOutLink } from './SignOutLink'
import { usePhoneVerification } from './usePhoneVerification'

/** Signed in but the number isn't confirmed yet (e.g. sign-up was interrupted). */
export function VerifyPhonePage({ phone }: { phone: string }) {
  const v = usePhoneVerification(formatGhanaPhone(phone))
  const confirmPhone = useMutation(api.account.confirmPhone)
  const [error, setError] = useState<string | null>(null)

  async function confirm(token: string) {
    try {
      await confirmPhone({ token })
    } catch (err) {
      setError(errorMessage(err))
      v.changeNumber()
    }
  }

  return (
    <AuthLayout title="Confirm your number" subtitle="We’ll text a code to your number." footer={<SignOutLink />}>
      {error && <p className={styles.error}>{error}</p>}
      {v.phone ? (
        <CodeStep v={v} onVerified={(token) => void confirm(token)} />
      ) : (
        <PhoneStep v={v} locked onSubmit={() => void v.send()} />
      )}
    </AuthLayout>
  )
}
