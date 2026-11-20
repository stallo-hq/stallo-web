import { IonApp, IonContent, IonPage, IonSpinner } from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { SetupBusinessPage } from '../features/auth/SetupBusinessPage'
import { SignInPage } from '../features/auth/SignInPage'
import { Shell } from './Shell'

export function App() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const seller = useQuery(api.sellers.mine, isAuthenticated ? {} : 'skip')

  let content
  if (isLoading || (isAuthenticated && seller === undefined)) {
    content = (
      <IonPage>
        <IonContent color="light">
          <div className="centered">
            <IonSpinner aria-label="Loading" />
          </div>
        </IonContent>
      </IonPage>
    )
  } else if (!isAuthenticated) {
    content = <SignInPage />
  } else if (seller === null) {
    content = <SetupBusinessPage />
  } else {
    content = (
      <IonReactRouter>
        <Shell />
      </IonReactRouter>
    )
  }

  return <IonApp>{content}</IonApp>
}
