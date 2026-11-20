import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { api } from '../convex/_generated/api'
import { router } from './app/router'

import '@fontsource-variable/geist'
import '@fontsource-variable/inter'
import './styles/tokens.css'
import './styles/base.css'

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is not set. Run `npx convex dev` in frontend/ first.')
}
const convex = new ConvexReactClient(convexUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider
      client={convex}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
        isAuthenticated: api.auth.isAuthenticated,
      }}
    >
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors closeButton />
    </ConvexAuthProvider>
  </StrictMode>,
)
