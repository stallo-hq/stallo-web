import { CreditCard, MessageCircle } from 'lucide-react'
import { ConnectionPage, type ConnectionCopy } from './ConnectionPage'

const WHATSAPP: ConnectionCopy = {
  kind: 'whatsapp',
  icon: MessageCircle,
  title: 'WhatsApp',
  description: 'Connect the number your customers already message.',
  connectedText: 'Customers can order on your WhatsApp number. Stallo replies within seconds.',
  benefits: [
    { title: 'Customers order the way they already do', text: 'Plain messages in English, Twi or Pidgin become orders.' },
    { title: 'Replies even when you’re busy', text: 'Stallo confirms orders and sends payment links any time of day.' },
    { title: 'You stay in control', text: 'Anything unclear comes to you under Needs attention instead of being guessed.' },
  ],
  checklist: [
    'The WhatsApp number you sell on, and the phone it’s on (to receive a code)',
    'Your business registration certificate',
    'A Facebook account to sign in to Meta during setup',
  ],
}

const PAYOUTS: ConnectionCopy = {
  kind: 'payouts',
  icon: CreditCard,
  title: 'Payouts',
  description: 'Choose where the money from your orders goes.',
  connectedText: 'Payments from your customers go straight to your payout account.',
  benefits: [
    { title: 'Customers pay by MoMo or card', text: 'Each confirmed order gets a secure Paystack payment link.' },
    { title: 'Money goes to your own account', text: 'Paystack settles to your MoMo wallet or bank account.' },
    { title: 'Every payment on record', text: 'See what was paid, when, and the fee, order by order.' },
  ],
  checklist: [
    'Your MoMo number or bank account number',
    'The name on that account',
    'Your Ghana Card number (Paystack may ask for it)',
  ],
}

export const WhatsAppPage = () => <ConnectionPage copy={WHATSAPP} />
export const PayoutsPage = () => <ConnectionPage copy={PAYOUTS} />
