import { DEFAULT_MIN_PASSWORD_LENGTH } from '@convex-dev/auth/methods/username-password'

/** User-facing text for Convex Auth's password errors. Shared by the backend and the web app. */
export function passwordMessage(error: string): string {
  switch (error) {
    case 'PASSWORD_TOO_SHORT':
      return `Use at least ${DEFAULT_MIN_PASSWORD_LENGTH} characters.`
    case 'PASSWORD_TOO_COMMON':
      return 'That password is too common. Choose another.'
    case 'PASSWORD_HAS_SURROUNDING_WHITESPACE':
      return 'Remove spaces at the start or end of the password.'
    default:
      return 'Choose a different password.'
  }
}

/** User-facing text for sign-in and sign-up errors from Convex Auth. */
export function authMessage(error: string): string {
  switch (error) {
    case 'INVALID_CREDENTIALS':
    case 'USER_NOT_FOUND':
      return 'That phone number and password don’t match.'
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a minute and try again.'
    case 'USERNAME_TAKEN':
      return 'An account with this phone number already exists. Sign in instead.'
    case 'OTHER_ERROR':
      return 'Couldn’t reach Stallo. Check your connection and try again.'
    default:
      return passwordMessage(error)
  }
}
