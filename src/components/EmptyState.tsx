import { IonIcon, IonText } from '@ionic/react'
import type { ReactNode } from 'react'

/** Plain icon, one line of explanation, optional single action. No illustrations. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: string
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state ion-padding">
      <IonIcon icon={icon} aria-hidden="true" className="empty-state-icon" color="medium" />
      <h2 className="text-title3">{title}</h2>
      <IonText color="medium">
        <p className="text-subheadline">{message}</p>
      </IonText>
      {action}
    </div>
  )
}
