import {
  IonBadge,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonRouterOutlet,
  IonSplitPane,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonText,
} from '@ionic/react'
import { Navigate, Route, useLocation } from 'react-router-dom'
import { OrdersPage } from '../features/orders/OrdersPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { PayoutsPage } from '../features/settings/PayoutsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { WhatsAppPage } from '../features/settings/WhatsAppPage'
import { TodayPage } from '../features/today/TodayPage'
import { useToday } from '../features/today/useToday'
import { useSeller } from '../hooks/useSeller'
import { formatGhanaPhone } from '../lib/phone'
import { isSelected, SECTIONS } from './navigation'

/**
 * App frame. Desktop and tablet (≥ 992px): sidebar + content. Phone: bottom tab bar.
 * Both are driven by the same SECTIONS list.
 */
export function Shell() {
  const { pathname } = useLocation()
  const seller = useSeller()
  const today = useToday()
  const attention = today?.attentionCount ?? 0

  return (
    <IonSplitPane contentId="main" when="lg">
      <IonMenu contentId="main" type="overlay" swipeGesture={false} className="sidebar">
        <IonContent color="light">
          <div className="sidebar-brand">
            <p className="text-title3">Stallo</p>
            {seller && (
              <IonText color="medium">
                <p className="text-footnote sidebar-business">{seller.businessName}</p>
              </IonText>
            )}
          </div>
          <IonList lines="none" className="sidebar-nav">
            {SECTIONS.map((s) => {
              const selected = isSelected(pathname, s.href)
              return (
                <IonItem
                  key={s.tab}
                  routerLink={s.href}
                  routerDirection="root"
                  detail={false}
                  className={selected ? 'sidebar-item selected' : 'sidebar-item'}
                  aria-current={selected ? 'page' : undefined}
                >
                  <IonIcon slot="start" icon={selected ? s.selectedIcon : s.icon} aria-hidden="true" />
                  <IonLabel>{s.label}</IonLabel>
                  {s.tab === 'today' && attention > 0 && (
                    <IonBadge slot="end" color="warning">
                      {attention}
                    </IonBadge>
                  )}
                </IonItem>
              )
            })}
          </IonList>
          {seller && (
            <IonText color="medium">
              <p className="text-caption sidebar-footer">Signed in as {formatGhanaPhone(seller.phone)}</p>
            </IonText>
          )}
        </IonContent>
      </IonMenu>

      <div className="ion-page" id="main">
        <IonTabs>
          <IonRouterOutlet>
            <Route path="/today" element={<TodayPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/whatsapp" element={<WhatsAppPage />} />
            <Route path="/settings/payouts" element={<PayoutsPage />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </IonRouterOutlet>

          <IonTabBar slot="bottom" translucent className="phone-tabbar">
            {SECTIONS.map((s) => {
              const selected = isSelected(pathname, s.href)
              return (
                <IonTabButton key={s.tab} tab={s.tab} href={s.href}>
                  <IonIcon aria-hidden="true" icon={selected ? s.selectedIcon : s.icon} />
                  <IonLabel>{s.label}</IonLabel>
                  {s.tab === 'today' && attention > 0 && <IonBadge color="warning">{attention}</IonBadge>}
                </IonTabButton>
              )
            })}
          </IonTabBar>
        </IonTabs>
      </div>
    </IonSplitPane>
  )
}
