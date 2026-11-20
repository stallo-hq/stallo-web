import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react'
import {
  cube,
  cubeOutline,
  receipt,
  receiptOutline,
  settings,
  settingsOutline,
  today,
  todayOutline,
} from 'ionicons/icons'
import { Navigate, Route, useLocation } from 'react-router-dom'
import { OrdersPage } from '../features/orders/OrdersPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TodayPage } from '../features/today/TodayPage'

const TABS = [
  { tab: 'today', href: '/today', label: 'Today', icon: todayOutline, selectedIcon: today },
  { tab: 'orders', href: '/orders', label: 'Orders', icon: receiptOutline, selectedIcon: receipt },
  { tab: 'products', href: '/products', label: 'Products', icon: cubeOutline, selectedIcon: cube },
  {
    tab: 'settings',
    href: '/settings',
    label: 'Settings',
    icon: settingsOutline,
    selectedIcon: settings,
  },
]

export function Tabs() {
  const { pathname } = useLocation()

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" translucent>
        {TABS.map((t) => {
          const selected = pathname.startsWith(t.href)
          return (
            <IonTabButton key={t.tab} tab={t.tab} href={t.href}>
              {/* Outline when idle, filled when selected, like iOS tab bars. */}
              <IonIcon aria-hidden="true" icon={selected ? t.selectedIcon : t.icon} />
              <IonLabel>{t.label}</IonLabel>
            </IonTabButton>
          )
        })}
      </IonTabBar>
    </IonTabs>
  )
}
