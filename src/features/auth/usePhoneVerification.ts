import { useAction, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorMessage } from '../../lib/errors'
import { toE164Ghana } from '../../lib/phone'

const RESEND_AFTER_S = 45

/**
 * Phone → SMS code → token. Shared by sign-up, forgot password and the
 * "confirm your number" screen. The token proves the user holds the number.
 */
export function usePhoneVerification(initialPhone = '') {
  const sendCode = useAction(api.phoneVerification.sendCode)
  const verifyCode = useAction(api.phoneVerification.verifyCode)
  const testMode = useQuery(api.site.smsTestMode) ?? false

  const [phoneInput, setPhoneInput] = useState(initialPhone)
  const [phone, setPhone] = useState<string | null>(null) // E.164 once a code is sent
  const [code, setCode] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  async function send(input = phoneInput): Promise<boolean> {
    setError(null)
    const e164 = toE164Ghana(input)
    if (e164 === null) {
      setError('Enter a Ghana mobile number, for example 024 123 4567.')
      return false
    }
    setBusy(true)
    try {
      await sendCode({ phone: e164 })
      setPhone(e164)
      setCode('')
      setResendIn(RESEND_AFTER_S)
      return true
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t send the code. Try again.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function verify(value = code): Promise<string | null> {
    if (phone === null) return null
    setError(null)
    if (value.length < 6) {
      setError('Enter the 6-digit code.')
      return null
    }
    setBusy(true)
    try {
      const result = await verifyCode({ phone, code: value })
      setToken(result.token)
      return result.token
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t check the code. Try again.'))
      setCode('')
      return null
    } finally {
      setBusy(false)
    }
  }

  function changeNumber() {
    setPhone(null)
    setCode('')
    setToken(null)
    setError(null)
  }

  return {
    phoneInput,
    setPhoneInput,
    phone,
    code,
    setCode,
    token,
    error,
    setError,
    busy,
    resendIn,
    testMode,
    send,
    resend: () => send(phone ?? phoneInput),
    verify,
    changeNumber,
  }
}

export type PhoneVerification = ReturnType<typeof usePhoneVerification>
