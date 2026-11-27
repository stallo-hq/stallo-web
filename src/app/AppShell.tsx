import { useAuthActions } from '@convex-dev/auth/react'
import { ArrowUpRight, CreditCard, LogOut, Menu, MessageCircle, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Logo, LogoMark } from '../components/Logo'
import { useOverview } from '../features/overview/useOverview'
import { useSeller } from '../hooks/useSeller'
import { cx } from '../lib/cx'
import { formatGhanaPhone } from '../lib/phone'
import styles from './AppShell.module.css'
import { routeSectionLabel, SECTIONS } from './navigation'

const SIDEBAR_STORAGE_KEY = 'stallo.sidebarCollapsed'

function readSidebarPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onClose,
  onNavigate,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
  onNavigate?: () => void
}) {
  const seller = useSeller()
  const overview = useOverview()
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const counts: Record<string, number | undefined> = {
    '/app': overview?.attentionCount || undefined,
    '/app/orders': overview ? overview.stats.awaitingPayment + overview.stats.toDeliver || undefined : undefined,
  }

  const opsSections = SECTIONS.filter((s) => s.group === 'operations')
  const shopSections = SECTIONS.filter((s) => s.group === 'shop')
  const shopReady = Boolean(seller?.whatsappConnected && seller?.payoutsConnected)
  const businessLabel = seller?.businessName ?? 'Shop'
  const businessTitle = seller ? `${seller.businessName} · ${formatGhanaPhone(seller.phone)}` : 'Loading shop'

  return (
    <div className={cx(styles.sidebar, collapsed && styles.sidebarCollapsed)}>
      <div className={styles.headerRow}>
        {collapsed ? (
          <Link to="/app" className={styles.logoMarkLink} onClick={onNavigate} aria-label="Stallo Overview" title="Stallo">
            <LogoMark size={26} />
          </Link>
        ) : (
          <Logo to="/app" tone="light" onClick={onNavigate} />
        )}

        {onClose && (
          <button type="button" className={styles.railButton} onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            className={styles.railButton}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        )}
      </div>

      <div className={styles.business} title={collapsed ? businessTitle : undefined}>
        <span className={styles.businessAvatar}>
          {seller?.businessName.slice(0, 1).toUpperCase() ?? ''}
          {collapsed && <span className={cx(styles.avatarDot, shopReady && styles.avatarDotReady)} aria-hidden="true" />}
        </span>
        {!collapsed && (
          <>
            <div className={styles.businessText}>
              <strong>{businessLabel}</strong>
              <span>{seller ? formatGhanaPhone(seller.phone) : ' '}</span>
            </div>
            {seller && (
              <span className={cx(styles.shopBadge, shopReady && styles.shopBadgeReady)}>{shopReady ? 'Live' : 'Setup'}</span>
            )}
          </>
        )}
      </div>

      <nav className={styles.nav} aria-label="Dashboard">
        <div className={styles.navGroup}>
          {!collapsed && <span className={styles.navLabel}>OPERATIONS</span>}
          {opsSections.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              title={collapsed ? (counts[to] ? `${label} (${counts[to]})` : label) : undefined}
              className={({ isActive }) => cx(styles.navItem, isActive && styles.active)}
            >
              <span className={styles.navIcon}>
                <Icon size={18} />
                {collapsed && counts[to] !== undefined && <span className={styles.collapsedCount}>{counts[to]}</span>}
              </span>
              {!collapsed && <span>{label}</span>}
              {!collapsed && counts[to] !== undefined && <span className={styles.count}>{counts[to]}</span>}
            </NavLink>
          ))}
        </div>

        <div className={styles.navGroup}>
          {!collapsed && <span className={styles.navLabel}>SHOP</span>}
          {shopSections.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={({ isActive }) => cx(styles.navItem, isActive && styles.active)}
            >
              <span className={styles.navIcon}>
                <Icon size={18} />
              </span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className={styles.dock}>
        {!collapsed && <span className={styles.dockLabel}>CHANNELS</span>}
        <div className={styles.channelsCard}>
          <Link
            to="/app/settings/whatsapp"
            className={styles.channelRow}
            onClick={onNavigate}
            title={
              collapsed
                ? `WhatsApp: ${seller === undefined ? 'Checking' : seller?.whatsappConnected ? 'Connected' : 'Action needed'}`
                : undefined
            }
          >
            {collapsed ? (
              <span className={styles.channelCompactIcon}>
                <MessageCircle size={17} />
                <span className={cx(styles.channelDot, seller?.whatsappConnected && styles.channelConnected)} />
              </span>
            ) : (
              <>
                <span className={styles.channelText}>
                  <strong>WhatsApp</strong>
                  <span>{seller === undefined ? 'Checking…' : seller?.whatsappConnected ? 'Connected' : 'Connect'}</span>
                </span>
                <ArrowUpRight size={15} className={styles.channelArrow} />
              </>
            )}
          </Link>

          <Link
            to="/app/settings/payouts"
            className={styles.channelRow}
            onClick={onNavigate}
            title={
              collapsed
                ? `Payouts: ${seller === undefined ? 'Checking' : seller?.payoutsConnected ? 'Ready' : 'Set up'}`
                : undefined
            }
          >
            {collapsed ? (
              <span className={styles.channelCompactIcon}>
                <CreditCard size={17} />
                <span className={cx(styles.channelDot, seller?.payoutsConnected && styles.channelConnected)} />
              </span>
            ) : (
              <>
                <span className={styles.channelText}>
                  <strong>Payouts</strong>
                  <span>{seller === undefined ? 'Checking…' : seller?.payoutsConnected ? 'Ready' : 'Set up'}</span>
                </span>
                <ArrowUpRight size={15} className={styles.channelArrow} />
              </>
            )}
          </Link>
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.signOut}
          title={collapsed ? 'Sign out' : undefined}
          aria-label="Sign out"
          onClick={() => void signOut().then(() => navigate('/', { replace: true }))}
        >
          <LogOut size={17} />
          {!collapsed && <span>Sign out</span>}
          {!collapsed && onToggleCollapse && <kbd className={styles.shortcut}>Ctrl+B</kbd>}
        </button>
      </div>
    </div>
  )
}

/** Dashboard frame: collapsible sidebar rail on desktop, top bar with a slide-out drawer on phones. */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readSidebarPreference)
  const { pathname } = useLocation()
  const sectionLabel = routeSectionLabel(pathname)

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      } catch {
        // Ignore storage quota / privacy mode failures.
      }
      return next
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className={styles.shell} data-dashboard-theme="landing" data-sidebar-collapsed={collapsed || undefined}>
      <aside className={styles.desktopSidebar}>
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Logo to="/app" tone="light" />
          <span className={styles.topbarDivider} aria-hidden="true" />
          <span className={styles.topbarSection}>
            {sectionLabel}
          </span>
        </div>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="dashboard-menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {menuOpen && (
        <div className={styles.drawerLayer}>
          <button type="button" className={styles.scrim} aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside id="dashboard-menu" className={styles.drawer} role="dialog" aria-modal="true" aria-label="Menu">
            <Sidebar onClose={() => setMenuOpen(false)} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
