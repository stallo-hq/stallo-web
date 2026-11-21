import { DEFAULT_MIN_PASSWORD_LENGTH } from '@convex-dev/auth/methods/username-password'
import { useSignUpWithUsernamePassword } from '@convex-dev/auth/methods/username-password/react'
import { useConvex, useMutation } from 'convex/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../../convex/_generated/api'
import { authMessage } from '../../../convex/lib/authMessages'
import { Button } from '../../components/ui/Button'
import { Field, PasswordField } from '../../components/ui/Field'
import { errorMessage } from '../../lib/errors'
import { toE164Ghana } from '../../lib/phone'
import styles from './auth.module.css'
import { AuthLayout } from './AuthLayout'
import { CodeStep, PhoneStep } from './PhoneSteps'
import { usePhoneVerification } from './usePhoneVerification'

const TITLES = {
  phone: { title: 'Start selling on WhatsApp', subtitle: 'Create your Stallo account. It’s free to start.' },
  code: { title: 'Check your messages', subtitle: 'Enter the code we just sent you.' },
  details: { title: 'Almost done', subtitle: 'Tell us your business name and choose a password.' },
}

export function SignUpPage() {
  const convex = useConvex()
  const navigate = useNavigate()
  const v = usePhoneVerification()
  const { signUp } = useSignUpWithUsernamePassword(api.auth)
  const confirmPhone = useMutation(api.account.confirmPhone)
  const createSeller = useMutation(api.sellers.create)

  const [existing, setExisting] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const step = v.token ? 'details' : v.phone ? 'code' : 'phone'

  async function startPhone() {
    setExisting(false)
    const phone = toE164Ghana(v.phoneInput)
    if (phone && (await convex.query(api.account.exists, { phone }))) {
      setExisting(true)
      return
    }
    await v.send()
  }

  async function finish(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (businessName.trim().length < 2) return setError('Enter your business name.')
    if (password.length < DEFAULT_MIN_PASSWORD_LENGTH) return setError(`Use at least ${DEFAULT_MIN_PASSWORD_LENGTH} characters for your password.`)
    if (!v.phone || !v.token) return
    setBusy(true)
    try {
      const result = await signUp({ username: v.phone, password })
      if (result.status !== 'complete') {
        setError(authMessage(result.userError.error))
        return
      }
      await confirmPhone({ token: v.token })
      await createSeller({ businessName })
      navigate('/app', { replace: true })
    } catch (err) {
      // The account exists by now; the dashboard picks up any step that didn't finish.
      setError(errorMessage(err))
      navigate('/app', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      {...TITLES[step]}
      footer={
        <>
          Already have an account? <Link to="/signin">Sign in</Link>
        </>
      }
    >
      <div className={styles.progress} aria-hidden="true">
        <span data-done />
        <span data-done={step !== 'phone' || undefined} />
        <span data-done={step === 'details' || undefined} />
      </div>

      {step === 'phone' && (
        <PhoneStep
          v={v}
          onSubmit={() => void startPhone()}
          extra={
            existing && (
              <p className={styles.notice}>
                This number already has a Stallo account. <Link to="/signin">Sign in</Link> or{' '}
                <Link to="/forgot-password">reset your password</Link>.
              </p>
            )
          }
        />
      )}

      {step === 'code' && <CodeStep v={v} />}

      {step === 'details' && (
        <form onSubmit={finish} noValidate className={styles.form}>
          <Field
            label="Business name"
            placeholder="Ama’s Kitchen"
            autoComplete="organization"
            maxLength={80}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            hint="Customers see this in WhatsApp and on payment pages."
            autoFocus
          />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            placeholder={`${DEFAULT_MIN_PASSWORD_LENGTH}+ characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            Create account
          </Button>
          <p className={styles.terms}>
            No monthly fee. You only pay a small fee on orders that are paid. By creating an account you agree to the{' '}
            <Link to="/terms">terms</Link> and <Link to="/privacy">privacy policy</Link>.
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
