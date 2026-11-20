import { IonButton, IonInput, IonItem, IonList, IonSpinner } from '@ionic/react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useRef, useState, type FormEvent } from 'react'
import { api } from '../../../convex/_generated/api'
import { SectionFooter } from '../../components/SectionFooter'
import { inputValue } from '../../lib/forms'
import { haptic } from '../../lib/haptics'
import { AuthLayout } from './AuthLayout'

/** Shown once, right after creating an account. */
export function SetupBusinessPage() {
  const createSeller = useMutation(api.sellers.create)
  const nameRef = useRef<HTMLIonInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const name = inputValue(nameRef)
    if (name.trim().length < 2) {
      haptic('error')
      setError('Enter your business name.')
      return
    }
    setPending(true)
    try {
      await createSeller({ businessName: name })
      haptic('success')
    } catch (err) {
      haptic('error')
      setError(err instanceof ConvexError ? String(err.data) : 'Couldn’t save. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Name your business" subtitle="This is the name customers see in WhatsApp and on payment links.">
      <form onSubmit={submit} noValidate>
        <IonList inset className="auth-list">
          <IonItem>
            <IonInput
              ref={nameRef}
              label="Name"
              labelPlacement="fixed"
              placeholder="Ama’s Kitchen"
              autocomplete="organization"
              maxlength={80}
            />
          </IonItem>
        </IonList>
        {error ? (
          <SectionFooter color="danger">{error}</SectionFooter>
        ) : (
          <SectionFooter>You can change it later in Settings.</SectionFooter>
        )}
        <IonButton type="submit" expand="block" disabled={pending}>
          {pending ? <IonSpinner name="crescent" /> : 'Continue'}
        </IonButton>
      </form>
    </AuthLayout>
  )
}
