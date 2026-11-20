import { LoaderCircle } from 'lucide-react'
import styles from './Spinner.module.css'

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return <LoaderCircle size={size} className={styles.spin} aria-label={label} aria-hidden={label ? undefined : true} />
}

/** Centred spinner for a whole page or panel while data loads. */
export function PageSpinner() {
  return (
    <div className={styles.page}>
      <Spinner size={24} label="Loading" />
    </div>
  )
}
