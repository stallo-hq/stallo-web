import {
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonText,
  IonSpinner,
} from '@ionic/react'
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from '@convex-dev/auth/methods/username-password/react'
import { DEFAULT_MIN_PASSWORD_LENGTH } from '@convex-dev/auth/methods/username-password'
import { useRef, useState, type FormEvent } from 'react'
import { api } from '../../../convex/_generated/api'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { haptic } from '../../lib/haptics'
import { toE164Ghana } from '../../lib/phone'

type Mode = 'signIn' | 'signUp'

function messageFor(error: string, mode: Mode): string {
  switch (error) {
    case 'INVALID_CREDENTIALS':
    case 'USER_NOT_FOUND':
      return 'That phone number and password don’t match.'
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a minute and try again.'
    case 'USERNAME_TAKEN':
      return 'An account with this phone number already exists. Sign in instead.'
    case 'PASSWORD_TOO_SHORT':
      return `Use at least ${DEFAULT_MIN_PASSWORD_LENGTH} characters.`
    case 'PASSWORD_TOO_COMMON':
      return 'That password is too common. Choose another.'
    case 'PASSWORD_HAS_SURROUNDING_WHITESPACE':
      return 'Remove spaces at the start or end of the password.'
    default:
      return mode === 'signIn'
        ? 'Couldn’t sign in. Check your connection and try again.'
        : 'Couldn’t create the account. Check your connection and try again.'
  }
}

export function SignInPage() {
  const [mode, setMode] = useState<Mode>('signIn')
  const [error, setError] = useState<string | null>(null)
  // Read the fields at submit time: pressing Enter can submit before the last
  // keystroke's input event has updated React state.
  const phoneRef = useRef<HTMLIonInputElement>(null)
  const passwordRef = useRef<HTMLIonInputElement>(null)

  const signIn = useSignInWithUsernamePassword(api.auth)
  const signUp = useSignUpWithUsernamePassword(api.auth)
  const pending = signIn.pending || signUp.pending

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const phone = String(phoneRef.current?.value ?? '')
    const password = String(passwordRef.current?.value ?? '')
    const username = toE164Ghana(phone)
    if (username === null) {
      haptic('error')
      setError('Enter a Ghana mobile number, for example 024 123 4567.')
      return
    }
    const run = mode === 'signIn' ? signIn.signIn : signUp.signUp
    const result = await run({ username, password })
    if (result.status === 'complete') {
      haptic('success')
    } else {
      haptic('error')
      setError(messageFor(result.userError.error, mode))
    }
  }

  return (
    <LargeTitlePage title="Stallo">
      <div className="ion-padding-horizontal">
        <IonSegment
          value={mode}
          onIonChange={(e) => {
            setMode(e.detail.value as Mode)
            setError(null)
            haptic('light')
          }}
        >
          <IonSegmentButton value="signIn">
            <IonLabel>Sign in</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="signUp">
            <IonLabel>Create account</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      <form onSubmit={submit} noValidate>
        <IonList inset>
          <IonItem>
            <IonInput
              label="Phone"
              labelPlacement="fixed"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="024 123 4567"
              ref={phoneRef}
              required
            />
          </IonItem>
          <IonItem>
            <IonInput
              label="Password"
              labelPlacement="fixed"
              type="password"
              autocomplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signUp' ? `At least ${DEFAULT_MIN_PASSWORD_LENGTH} characters` : 'Required'}
              ref={passwordRef}
              required
            >
              <IonInputPasswordToggle slot="end" />
            </IonInput>
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
            <p className="list-footer text-footnote">
              {mode === 'signIn'
                ? 'Use the phone number you signed up with.'
                : 'Use the phone number for your business.'}
            </p>
          </IonText>
        )}

        <div className="ion-padding-horizontal">
          <IonButton type="submit" expand="block" disabled={pending}>
            {pending ? <IonSpinner name="crescent" /> : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </IonButton>
        </div>
      </form>
    </LargeTitlePage>
  )
}
