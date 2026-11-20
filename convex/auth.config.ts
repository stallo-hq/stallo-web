import type { AuthConfig } from 'convex/server'
import { convexAuthProvider } from '@convex-dev/auth/server'

// Without this file every request is treated as signed out, with no error.
export default {
  providers: [convexAuthProvider()],
} satisfies AuthConfig
