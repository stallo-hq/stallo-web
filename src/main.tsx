import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setupIonicReact } from '@ionic/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { api } from '../convex/_generated/api'
import { App } from './app/App'

/* Ionic core CSS (required) */
import '@ionic/react/css/core.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
/* Ionic utilities */
import '@ionic/react/css/padding.css'
import '@ionic/react/css/text-alignment.css'
import '@ionic/react/css/flex-utils.css'
import '@ionic/react/css/display.css'
/* Dark mode follows the device setting */
import '@ionic/react/css/palettes/dark.system.css'
/* Stallo theme */
import './theme/typography.css'
import './theme/app.css'

// iOS look and behaviour on every platform, including Android.
setupIonicReact({ mode: 'ios' })

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
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
)
