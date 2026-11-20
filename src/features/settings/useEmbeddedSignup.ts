import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Meta's WhatsApp Embedded Signup: loads the Facebook SDK, opens the signup
 * popup and collects the two things it returns — a short-lived code (from the
 * login callback) and the number's ids (from a window message).
 * https://developers.facebook.com/docs/whatsapp/embedded-signup
 */

type FacebookSDK = {
  init: (options: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void
  login: (
    callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
    options: Record<string, unknown>,
  ) => void
}

declare global {
  interface Window {
    FB?: FacebookSDK
    fbAsyncInit?: () => void
  }
}

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js'

function loadSdk(appId: string, version: string): Promise<FacebookSDK> {
  if (window.FB) return Promise.resolve(window.FB)
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version })
      resolve(window.FB!)
    }
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => reject(new Error('Couldn’t load Meta’s sign-in. Check your connection or turn off ad blockers, then try again.'))
    document.body.appendChild(script)
  })
}

export type SignupResult = { code: string; phoneNumberId: string; wabaId: string }

export function useEmbeddedSignup(config: { appId: string; configId: string; graphVersion: string } | null) {
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const session = useRef<{ phoneNumberId?: string; wabaId?: string; cancelled?: boolean; error?: string }>({})

  useEffect(() => {
    if (!config) return
    let alive = true
    loadSdk(config.appId, config.graphVersion)
      .then(() => alive && setReady(true))
      .catch((e: Error) => alive && setLoadError(e.message))

    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith('facebook.com')) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return
        if (data.event === 'CANCEL') session.current.cancelled = true
        else if (data.event === 'ERROR') session.current.error = data.data?.error_message ?? 'Meta reported an error'
        else if (typeof data.event === 'string' && data.event.startsWith('FINISH')) {
          session.current.phoneNumberId = data.data?.phone_number_id
          session.current.wabaId = data.data?.waba_id
        }
      } catch {
        // Not a message for us.
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      alive = false
      window.removeEventListener('message', onMessage)
    }
  }, [config])

  /** Opens the popup. Resolves with what Meta returned, or rejects with a message for the seller. */
  const start = useCallback(
    (keepBusinessApp: boolean): Promise<SignupResult> =>
      new Promise((resolve, reject) => {
        if (!config || !window.FB) return reject(new Error('Meta’s sign-in isn’t ready yet. Try again in a moment.'))
        session.current = {}
        window.FB.login(
          (response) => {
            const code = response.authResponse?.code
            // The session message can arrive just after the callback; give it a moment.
            setTimeout(() => {
              const { phoneNumberId, wabaId, cancelled, error } = session.current
              if (error) return reject(new Error(error))
              if (!code || cancelled) return reject(new Error('Setup was closed before it finished.'))
              if (!phoneNumberId || !wabaId) return reject(new Error('Meta didn’t share the number’s details. Please try again.'))
              resolve({ code, phoneNumberId, wabaId })
            }, 800)
          },
          {
            config_id: config.configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              sessionInfoVersion: '3',
              ...(keepBusinessApp ? { featureType: 'whatsapp_business_app_onboarding' } : {}),
            },
          },
        )
      }),
    [config],
  )

  return { ready, loadError, start }
}
