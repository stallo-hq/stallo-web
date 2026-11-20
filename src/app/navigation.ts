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

/** The four sections. One list drives both the desktop sidebar and the phone tab bar. */
export const SECTIONS = [
  { tab: 'today', href: '/today', label: 'Today', icon: todayOutline, selectedIcon: today },
  { tab: 'orders', href: '/orders', label: 'Orders', icon: receiptOutline, selectedIcon: receipt },
  { tab: 'products', href: '/products', label: 'Products', icon: cubeOutline, selectedIcon: cube },
  { tab: 'settings', href: '/settings', label: 'Settings', icon: settingsOutline, selectedIcon: settings },
] as const

export function isSelected(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
