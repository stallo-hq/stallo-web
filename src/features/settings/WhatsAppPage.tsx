import { chatbubblesOutline, logoWhatsapp, notificationsOutline, timeOutline } from 'ionicons/icons'
import { useSeller } from '../../hooks/useSeller'
import { ConnectionPage, type ConnectionCopy } from './ConnectionPage'
import { useSettingsActions } from './useSettings'

const COPY: ConnectionCopy = {
  title: 'WhatsApp',
  icon: logoWhatsapp,
  intro: 'Take orders on your WhatsApp number',
  benefits: [
    {
      icon: chatbubblesOutline,
      title: 'Customers order the way they already do',
      detail: 'They message your number in plain language. Stallo turns it into an order and confirms it.',
    },
    {
      icon: timeOutline,
      title: 'Replies even when you’re busy',
      detail: 'Stallo answers within seconds, any time of day.',
    },
    {
      icon: notificationsOutline,
      title: 'You stay in control',
      detail: 'Anything unclear comes to you under Needs attention instead of guessing.',
    },
  ],
  needs: [
    'The WhatsApp number you sell on, and the phone it’s on (to receive a code)',
    'Your business registration certificate',
    'A Facebook account to sign in to Meta during setup',
  ],
  requestLabel: 'Request WhatsApp setup',
}

export function WhatsAppPage() {
  const seller = useSeller()
  const { requestSetup } = useSettingsActions()
  if (!seller) return null
  return (
    <ConnectionPage
      copy={COPY}
      connected={seller.whatsappConnected}
      requestedAt={seller.whatsappSetupRequestedAt}
      phone={seller.phone}
      onRequest={() => requestSetup({ kind: 'whatsapp' })}
    />
  )
}
