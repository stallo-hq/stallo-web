import { Logo } from '../components/Logo'
import { ButtonLink } from '../components/ui/Button'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <Logo />
      <h1>This page doesn’t exist.</h1>
      <p>The link may be old or mistyped.</p>
      <ButtonLink to="/" variant="primary" size="lg">
        Go to the home page
      </ButtonLink>
    </div>
  )
}
