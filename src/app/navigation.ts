import { LayoutDashboard, Package, Settings, ShoppingBag, type LucideIcon } from 'lucide-react'

export type Section = { to: string; label: string; icon: LucideIcon; end?: boolean }

/** The dashboard's sections, in sidebar order. */
export const SECTIONS: Section[] = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/app/products', label: 'Products', icon: Package },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]
