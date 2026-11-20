import { useAuthActions } from '@convex-dev/auth/react'
import { useNavigate } from 'react-router'
import styles from './auth.module.css'

export function SignOutLink() {
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  return (
    <>
      Wrong account?{' '}
      <button
        type="button"
        className={styles.inlineLink}
        onClick={() => void signOut().then(() => navigate('/signin', { replace: true }))}
      >
        Sign out
      </button>
    </>
  )
}
