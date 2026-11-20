import { IonButton, IonInput, IonItem, IonList, IonSpinner, IonText } from '@ionic/react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useRef, useState, type FormEvent } from 'react'
import { api } from '../../../convex/_generated/api'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { haptic } from '../../lib/haptics'

/** Shown once, right after creating an account. */
export function SetupBusinessPage() {
  const createSeller = useMutation(api.sellers.create)
  const nameRef = useRef<HTMLIonInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // Read at submit time so Enter never submits a stale value.
    const name = String(nameRef.current?.value ?? '')
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
    <LargeTitlePage title="Your business">
      <form onSubmit={submit} noValidate>
        <IonList inset>
          <IonItem>
            <IonInput
              label="Name"
              labelPlacement="fixed"
              placeholder="e.g. Ama’s Kitchen"
              autocomplete="organization"
              maxlength={80}
              ref={nameRef}
            />
          </IonItem>
        </IonList>
        {error ? (
          <IonText color="danger">
            <p className="list-footer text-footnote" role="alert">
              {error}
            </p>
          </IonText>
        ) : (
          <IonText color="medium">
            <p className="list-footer text-footnote">Customers see this name in WhatsApp messages.</p>
          </IonText>
        )}
        <div className="ion-padding-horizontal">
          <IonButton type="submit" expand="block" disabled={pending}>
            {pending ? <IonSpinner name="crescent" /> : 'Continue'}
          </IonButton>
        </div>
      </form>
    </LargeTitlePage>
  )
}
