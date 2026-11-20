import { calendarOutline, cashOutline, receiptOutline, shieldCheckmarkOutline } from 'ionicons/icons'
import { useSeller } from '../../hooks/useSeller'
import { ConnectionPage, type ConnectionCopy } from './ConnectionPage'
import { useSettingsActions } from './useSettings'

const COPY: ConnectionCopy = {
  title: 'Payouts',
  icon: cashOutline,
  intro: 'Get paid to your MoMo or bank account',
  benefits: [
    {
      icon: shieldCheckmarkOutline,
      title: 'Secure payments through Paystack',
      detail: 'Customers pay by MoMo or card through a Paystack link. Stallo never holds your money.',
    },
    {
      icon: calendarOutline,
      title: 'Paid out the next working day',
      detail: 'Money goes straight from Paystack to your account.',
    },
    {
      icon: receiptOutline,
      title: 'Pay only when you sell',
      detail: 'Stallo’s small fee is taken from each paid order. No monthly subscription.',
    },
  ],
  needs: [
    'Your MoMo number or bank account, in your name or your business’s name',
    'Your Ghana Card',
  ],
  requestLabel: 'Request payout setup',
}

export function PayoutsPage() {
  const seller = useSeller()
  const { requestSetup } = useSettingsActions()
  if (!seller) return null
  return (
    <ConnectionPage
      copy={COPY}
      connected={seller.payoutsConnected}
      requestedAt={seller.payoutsSetupRequestedAt}
      phone={seller.phone}
      onRequest={() => requestSetup({ kind: 'payouts' })}
    />
  )
}
