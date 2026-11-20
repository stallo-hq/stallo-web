import { useMutation } from 'convex/react'
import { useState, type FormEvent } from 'react'
import { api } from '../../../convex/_generated/api'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { errorMessage } from '../../lib/errors'
import styles from './auth.module.css'
import { AuthLayout } from './AuthLayout'
import { SignOutLink } from './SignOutLink'

/** Signed in and verified, but no business yet. */
export function SetupBusinessPage() {
  const createSeller = useMutation(api.sellers.create)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return setError('Enter your business name.')
    setBusy(true)
    try {
      await createSeller({ businessName: name })
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t save. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Name your business" subtitle="Customers see this in WhatsApp and on payment pages." footer={<SignOutLink />}>
      <form onSubmit={submit} noValidate className={styles.form}>
        <Field
          label="Business name"
          placeholder="Ama’s Kitchen"
          autoComplete="organization"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
        />
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Continue
        </Button>
      </form>
    </AuthLayout>
  )
}
