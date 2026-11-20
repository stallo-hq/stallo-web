import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react'
import type { ReactNode } from 'react'

/**
 * Standard page: translucent navigation bar whose title collapses from a large
 * title as you scroll, over the grouped background, with content in a centred
 * column on wide screens. Only arranges Ionic's own components.
 */
export function LargeTitlePage({
  title,
  subtitle,
  backHref,
  toolbarEnd,
  children,
}: {
  title: string
  subtitle?: string
  /** Shows a Back button that returns here (for pages pushed from another page). */
  backHref?: string
  toolbarEnd?: ReactNode
  children: ReactNode
}) {
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          {backHref && (
            <IonButtons slot="start">
              <IonBackButton defaultHref={backHref} />
            </IonButtons>
          )}
          <IonTitle>{title}</IonTitle>
          {toolbarEnd}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen color="light">
        <div className="page">
          <IonHeader collapse="condense">
            <IonToolbar color="light">
              <IonTitle size="large">{title}</IonTitle>
            </IonToolbar>
          </IonHeader>
          {subtitle && (
            <IonText color="medium">
              <p className="page-subtitle text-subheadline">{subtitle}</p>
            </IonText>
          )}
          {children}
        </div>
      </IonContent>
    </IonPage>
  )
}
