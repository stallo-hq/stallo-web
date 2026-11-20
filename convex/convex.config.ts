import { defineApp } from 'convex/server'
import auth from '@convex-dev/auth/convex.config.js'
import authPassword from '@convex-dev/auth/components/password/convex.config.js'
import authUsername from '@convex-dev/auth/components/username/convex.config.js'

const app = defineApp()

// Convex Auth core must be mounted as `auth` (the default name).
app.use(auth)
// Phone number + password sign-in: the phone number (E.164) is the username.
app.use(authPassword)
app.use(authUsername)

export default app
