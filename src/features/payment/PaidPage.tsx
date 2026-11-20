import { CheckCircle2 } from 'lucide-react'
import { LogoMark } from '../../components/Logo'
import styles from './PaidPage.module.css'

/** Where Paystack sends customers after paying. The seller confirms on WhatsApp once Paystack tells us. */
export function PaidPage() {
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
