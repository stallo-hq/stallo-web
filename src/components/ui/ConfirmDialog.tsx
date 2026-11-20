import { useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  /** Red confirm button for destructive actions. */
  destructive?: boolean
  onConfirm: () => Promise<unknown> | void
}

/** "Are you sure?" with Cancel and one confirm button. Stays open with a spinner until onConfirm settles. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'dark'} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
