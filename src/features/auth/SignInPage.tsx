import { useSignInWithUsernamePassword } from '@convex-dev/auth/methods/username-password/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../../convex/_generated/api'
import { authMessage } from '../../../convex/lib/authMessages'
import { Button } from '../../components/ui/Button'
import { Field, PasswordField } from '../../components/ui/Field'
import { toE164Ghana } from '../../lib/phone'
import styles from './auth.module.css'
import { AuthLayout } from './AuthLayout'

export function SignInPage() {
  const navigate = useNavigate()
  const { signIn, pending } = useSignInWithUsernamePassword(api.auth)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const username = toE164Ghana(phone)
    if (username === null) return setError('Enter a Ghana mobile number, for example 024 123 4567.')
    if (password === '') return setError('Enter your password.')
    const result = await signIn({ username, password })
    if (result.status === 'complete') navigate('/app', { replace: true })
    else setError(authMessage(result.userError.error))
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see today’s orders."
      footer={
        <>
          New to Stallo? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className={styles.form}>
        <Field
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="024 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoFocus
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className={styles.row}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : (
            <span />
          )}
          <Link to="/forgot-password" className={styles.forgot}>
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="dark" size="lg" block loading={pending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
