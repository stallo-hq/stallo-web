import { useAuthActions } from '@convex-dev/auth/react'
import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Logo } from '../components/Logo'
import { useSeller } from '../hooks/useSeller'
import { cx } from '../lib/cx'
import { formatGhanaPhone } from '../lib/phone'
import { useOverview } from '../features/overview/useOverview'
import styles from './AppShell.module.css'
import { SECTIONS } from './navigation'

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const seller = useSeller()
  const overview = useOverview()
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const counts: Record<string, number | undefined> = {
    '/app': overview?.attentionCount || undefined,
    '/app/orders': overview ? overview.stats.awaitingPayment + overview.stats.toDeliver || undefined : undefined,
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.brand}>
        <Logo to="/app" onClick={onNavigate} />
      </div>
      <div className={styles.business}>
        <span className={styles.businessAvatar}>{seller?.businessName.slice(0, 1).toUpperCase() ?? ''}</span>
        <div className={styles.businessText}>
          <strong>{seller?.businessName ?? ' '}</strong>
          <span>{seller ? formatGhanaPhone(seller.phone) : ' '}</span>
        </div>
      </div>
      <nav className={styles.nav} aria-label="Dashboard">
        <span className={styles.navLabel}>WORKSPACE</span>
        {SECTIONS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cx(styles.navItem, isActive && styles.active)}
          >
            <Icon size={19} />
            <span>{label}</span>
            {counts[to] !== undefined && <span className={styles.count}>{counts[to]}</span>}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        className={styles.signOut}
        onClick={() => void signOut().then(() => navigate('/', { replace: true }))}
      >
        <LogOut size={18} /> Sign out
      </button>
    </div>
  )
}

/** Dashboard frame: sidebar on desktop, top bar with a slide-out menu on phones. */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className={styles.shell}>
      <aside className={styles.desktopSidebar}>
        <Sidebar />
      </aside>

      <header className={styles.topbar}>
        <Logo to="/app" />
        <button type="button" className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </header>

      {menuOpen && (
        <div className={styles.drawerLayer}>
          <button type="button" className={styles.scrim} aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" className={styles.closeButton} onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={20} />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
