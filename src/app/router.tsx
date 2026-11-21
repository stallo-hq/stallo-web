import { createBrowserRouter } from 'react-router'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { SignInPage } from '../features/auth/SignInPage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { LandingPage } from '../features/landing/LandingPage'
import { PrivacyPage } from '../features/legal/PrivacyPage'
import { TermsPage } from '../features/legal/TermsPage'
import { OrderDetailPage } from '../features/orders/OrderDetailPage'
import { OrdersPage } from '../features/orders/OrdersPage'
import { PaidPage } from '../features/payment/PaidPage'
import { OverviewPage } from '../features/overview/OverviewPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { RiderPage } from '../features/rider/RiderPage'
import { PayoutsPage, WhatsAppPage } from '../features/settings/connections'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AccountGate, GuestOnly } from './AccountGate'
import { AppShell } from './AppShell'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  {
    element: <GuestOnly />,
    children: [
      { path: '/signin', element: <SignInPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  // Sign-up signs the user in halfway through, so it must not redirect when that happens.
  { path: '/signup', element: <SignUpPage /> },
  {
    path: '/app',
    element: <AccountGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:orderId', element: <OrderDetailPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/whatsapp', element: <WhatsAppPage /> },
          { path: 'settings/payouts', element: <PayoutsPage /> },
        ],
      },
    ],
  },
  // Public pages linked from WhatsApp and Paystack.
  { path: '/r/:token', element: <RiderPage /> },
  { path: '/paid', element: <PaidPage /> },
  { path: '*', element: <NotFoundPage /> },
])
