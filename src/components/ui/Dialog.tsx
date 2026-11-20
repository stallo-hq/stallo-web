import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import styles from './Dialog.module.css'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children?: ReactNode
  /** Buttons along the bottom. */
  footer?: ReactNode
  /** Wraps the body and footer in a form so Enter submits. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
}

/** Centred dialog on desktop, bottom sheet on phones. */
export function Dialog({ open, onOpenChange, title, description, children, footer, onSubmit }: DialogProps) {
  const inner = (
    <>
      {children ? <div className={styles.body}>{children}</div> : null}
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  )
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={styles.content}>
          <div className={styles.header}>
            <div>
              <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="visually-hidden">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className={styles.close} aria-label="Close">
              <X size={18} />
            </RadixDialog.Close>
          </div>
          {onSubmit ? (
            <form onSubmit={onSubmit} noValidate className={styles.form}>
              {inner}
            </form>
          ) : (
            inner
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
