import { DEFAULT_MIN_PASSWORD_LENGTH } from '@convex-dev/auth/methods/username-password'
import { useSignInWithUsernamePassword } from '@convex-dev/auth/methods/username-password/react'
import { useConvex, useMutation } from 'convex/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../../convex/_generated/api'
import { authMessage } from '../../../convex/lib/authMessages'
import { Button } from '../../components/ui/Button'
import { PasswordField } from '../../components/ui/Field'
import { errorMessage } from '../../lib/errors'
import { toE164Ghana } from '../../lib/phone'
import styles from './auth.module.css'
import { AuthLayout } from './AuthLayout'
import { CodeStep, PhoneStep } from './PhoneSteps'
import { usePhoneVerification } from './usePhoneVerification'

export function ForgotPasswordPage() {
  const convex = useConvex()
  const navigate = useNavigate()
  const v = usePhoneVerification()
  const resetPassword = useMutation(api.account.resetPassword)
  const { signIn } = useSignInWithUsernamePassword(api.auth)

  const [noAccount, setNoAccount] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const step = v.token ? 'password' : v.phone ? 'code' : 'phone'

  async function startPhone() {
    setNoAccount(false)
    const phone = toE164Ghana(v.phoneInput)
    if (phone && !(await convex.query(api.account.exists, { phone }))) {
      setNoAccount(true)
      return
    }
    await v.send()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < DEFAULT_MIN_PASSWORD_LENGTH) return setError(`Use at least ${DEFAULT_MIN_PASSWORD_LENGTH} characters.`)
    if (!v.phone || !v.token) return
    setBusy(true)
    try {
      const result = await resetPassword({ phone: v.phone, token: v.token, newPassword: password })
      if (!result.ok) return setError(result.message)
      const signedIn = await signIn({ username: v.phone, password })
      if (signedIn.status === 'complete') navigate('/app', { replace: true })
      else setError(authMessage(signedIn.userError.error))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    phone: ['Reset your password', 'We’ll text a code to the number you signed up with.'],
    code: ['Check your messages', 'Enter the code we just sent you.'],
    password: ['Choose a new password', 'You’ll be signed out everywhere else.'],
  } as const

  return (
    <AuthLayout
      title={titles[step][0]}
      subtitle={titles[step][1]}
      footer={
        <>
          Remembered it? <Link to="/signin">Sign in</Link>
        </>
      }
    >
      {step === 'phone' && (
        <PhoneStep
          v={v}
          onSubmit={() => void startPhone()}
          extra={
            noAccount && (
              <p className={styles.notice}>
                There’s no account for this number. <Link to="/signup">Create one</Link>.
              </p>
            )
          }
        />
      )}
      {step === 'code' && <CodeStep v={v} />}
      {step === 'password' && (
        <form onSubmit={submit} noValidate className={styles.form}>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            placeholder={`${DEFAULT_MIN_PASSWORD_LENGTH}+ characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            autoFocus
          />
          <Button type="submit" variant="dark" size="lg" block loading={busy}>
            Save and sign in
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
