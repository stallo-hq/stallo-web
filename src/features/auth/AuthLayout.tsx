import { IonContent, IonPage, IonText } from '@ionic/react'
import type { ReactNode } from 'react'

/** Centred column for signed-out screens, narrow on every screen size. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <IonPage>
      <IonContent color="light">
        <main className="auth">
          <p className="auth-brand text-headline">Stallo</p>
          <h1 className="text-large-title">{title}</h1>
          <IonText color="medium">
            <p className="auth-subtitle text-body">{subtitle}</p>
          </IonText>
          {children}
        </main>
      </IonContent>
    </IonPage>
  )
}
