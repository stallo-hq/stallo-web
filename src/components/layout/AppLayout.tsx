import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/orders', label: 'Orders' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/payments', label: 'Payments' },
  { to: '/attention', label: 'Needs attention' },
  { to: '/settings', label: 'Settings' },
]

export function AppLayout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Stallo</div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
