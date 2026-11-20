import { setupConvexAuth } from '@convex-dev/auth/server'
import { setupUsernamePassword } from '@convex-dev/auth/methods/username-password/server'
import { components, internal } from './_generated/api'

const auth = setupConvexAuth({ component: components.auth })

export const { signOut, refreshSession, isAuthenticated } = auth

// Sellers sign in with their phone number (normalised to +233...) and a password.
// The client normalises the number before calling these.
export const { signUpWithUsernamePassword, signInWithUsernamePassword, changePassword } =
  setupUsernamePassword(auth, {
    component: components.authPassword,
    usernameComponent: components.authUsername,
  }).attachUserCallbacks({ createUser: internal.users.createUser })
