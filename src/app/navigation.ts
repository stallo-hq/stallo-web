import { LayoutDashboard, Package, Settings, ShoppingBag, type LucideIcon } from 'lucide-react'

export type SectionGroup = 'operations' | 'shop'
export type Section = { to: string; label: string; icon: LucideIcon; group: SectionGroup; end?: boolean }

/** The dashboard's sections, in sidebar order. */
export const SECTIONS: Section[] = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, group: 'operations', end: true },
  { to: '/app/orders', label: 'Orders', icon: ShoppingBag, group: 'operations' },
  { to: '/app/products', label: 'Products', icon: Package, group: 'operations' },
  { to: '/app/settings', label: 'Settings', icon: Settings, group: 'shop' },
]

/** Human-readable section name for the mobile top bar. */
export function routeSectionLabel(pathname: string): string {
  if (pathname.startsWith('/app/orders/')) return 'Order'
  if (pathname.startsWith('/app/orders')) return 'Orders'
  if (pathname.startsWith('/app/products')) return 'Products'
  if (pathname.startsWith('/app/settings/whatsapp')) return 'WhatsApp'
  if (pathname.startsWith('/app/settings/payouts')) return 'Payouts'
  if (pathname.startsWith('/app/settings')) return 'Settings'
  return 'Overview'
}
