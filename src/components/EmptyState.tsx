import { IonButton, IonIcon, IonText } from '@ionic/react'

/** Plain icon, a title, one line of explanation, and at most one action. No illustrations. */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionHref,
}: {
  icon: string
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
}) {
  return (
    <div className="empty-state">
      <IonIcon icon={icon} aria-hidden="true" className="empty-state-icon" color="medium" />
      <h2 className="text-title3">{title}</h2>
      <IonText color="medium">
        <p className="text-subheadline">{message}</p>
      </IonText>
      {actionLabel && (onAction || actionHref) && (
        <IonButton onClick={onAction} routerLink={actionHref}>
          {actionLabel}
        </IonButton>
      )}
    </div>
  )
}
