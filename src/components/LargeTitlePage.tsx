import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react'
import type { ReactNode } from 'react'

/**
 * The standard iOS page layout: a translucent navigation bar whose title collapses
 * from a large title as you scroll, over the grouped (light) background used by inset lists.
 * It only arranges Ionic's own components.
 */
export function LargeTitlePage({
  title,
  toolbarEnd,
  children,
}: {
  title: string
  toolbarEnd?: ReactNode
  children: ReactNode
}) {
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          {toolbarEnd}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen color="light">
        <IonHeader collapse="condense">
          <IonToolbar color="light">
            <IonTitle size="large">{title}</IonTitle>
          </IonToolbar>
        </IonHeader>
        {children}
      </IonContent>
    </IonPage>
  )
}
