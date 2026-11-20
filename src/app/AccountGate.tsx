import { useConvexAuth, useQuery } from 'convex/react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { api } from '../../convex/_generated/api'
import { PageSpinner } from '../components/ui/Spinner'
import { SetupBusinessPage } from '../features/auth/SetupBusinessPage'
import { VerifyPhonePage } from '../features/auth/VerifyPhonePage'

/**
 * Guards the dashboard. Signed out → sign in. Signed in but sign-up unfinished →
 * the step that's missing (confirm the number, name the business). Otherwise the app.
 */
export function AccountGate() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const me = useQuery(api.account.me, isAuthenticated ? {} : 'skip')
  const location = useLocation()

  if (isLoading || (isAuthenticated && me === undefined)) return <PageSpinner />
  if (!isAuthenticated || me === null || me === undefined) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  if (!me.phoneVerified) return <VerifyPhonePage phone={me.phone ?? ''} />
  if (!me.hasSeller) return <SetupBusinessPage />
  return <Outlet />
}

/** Signed-in people skip the sign-in and sign-up screens. */
export function GuestOnly() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading) return <PageSpinner />
  if (isAuthenticated) return <Navigate to="/app" replace />
  return <Outlet />
}
