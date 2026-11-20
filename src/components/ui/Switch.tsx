import * as RadixSwitch from '@radix-ui/react-switch'
import { useId, type ReactNode } from 'react'
import styles from './Switch.module.css'

/** On/off setting with a label and optional explanation. */
export function Switch({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string
  hint?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className={styles.row}>
      <label htmlFor={id} className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      <RadixSwitch.Root id={id} className={styles.root} checked={checked} onCheckedChange={onCheckedChange}>
        <RadixSwitch.Thumb className={styles.thumb} />
      </RadixSwitch.Root>
    </div>
  )
}
