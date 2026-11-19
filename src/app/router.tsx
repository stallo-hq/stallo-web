import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ExceptionsPage } from '../features/exceptions/ExceptionsPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { OrdersPage } from '../features/orders/OrdersPage'
import { PaymentsPage } from '../features/payments/PaymentsPage'
import { SettingsPage } from '../features/settings/SettingsPage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'attention', element: <ExceptionsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
