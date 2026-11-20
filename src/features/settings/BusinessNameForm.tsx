import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react'
import { ConvexError } from 'convex/values'
import { useRef, useState, type FormEvent } from 'react'
import { SectionFooter } from '../../components/SectionFooter'
import { inputValue } from '../../lib/forms'
import { haptic } from '../../lib/haptics'

export function BusinessNameForm({
  isOpen,
  current,
  onSave,
  onClose,
}: {
  isOpen: boolean
  current: string
  onSave: (businessName: string) => Promise<unknown>
  onClose: () => void
}) {
  const nameRef = useRef<HTMLIonInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const formId = 'business-name-form'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const name = inputValue(nameRef).trim()
    if (name.length < 2) {
      haptic('error')
      setError('Enter your business name.')
      return
    }
    setSaving(true)
    try {
      await onSave(name)
      haptic('success')
      onClose()
    } catch (err) {
      haptic('error')
      setError(err instanceof ConvexError ? String(err.data) : 'Couldn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} onWillPresent={() => setError(null)}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>Business name</IonTitle>
          <IonButtons slot="end">
            <IonButton type="submit" form={formId} strong disabled={saving}>
              Save
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent color="light">
        <form id={formId} onSubmit={submit} noValidate>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          <IonList inset className="ion-margin-top">
            <IonItem>
              <IonInput
                ref={nameRef}
                aria-label="Business name"
                value={current}
                maxlength={80}
                autocomplete="organization"
                clearInput
              />
            </IonItem>
          </IonList>
          {error ? (
            <SectionFooter color="danger">{error}</SectionFooter>
          ) : (
            <SectionFooter>Customers see this name in WhatsApp messages and payment links.</SectionFooter>
          )}
        </form>
      </IonContent>
    </IonModal>
  )
}
