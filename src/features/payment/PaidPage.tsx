import { useAction } from 'convex/react'
import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../../../convex/_generated/api'
import { LogoMark } from '../../components/Logo'
import styles from './PaidPage.module.css'

/**
 * Where Paystack sends customers after paying. Asks Stallo to check the payment
 * with Paystack straight away, so the order is confirmed even if the webhook is late.
 */
export function PaidPage() {
  const [params] = useSearchParams()
  const reference = params.get('reference') ?? params.get('trxref')
  const checkPayment = useAction(api.payments.checkPayment)

  useEffect(() => {
    if (reference) checkPayment({ reference }).catch(() => undefined)
  }, [reference, checkPayment])

  return (
    <div className={styles.page}>
      <LogoMark size={36} />
      <CheckCircle2 size={48} className={styles.icon} />
      <h1>Thank you</h1>
      <p>
        Your payment is being confirmed. You’ll get a message on WhatsApp in a moment. You can close this page and go back to
        WhatsApp.
      </p>
    </div>
  )
}
