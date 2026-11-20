import { IonText } from '@ionic/react'

/** iOS grouped-list section header: small, uppercase, secondary colour, above the inset group. */
export function SectionHeader({ children }: { children: string }) {
  return (
    <IonText color="medium">
      <h2 className="list-header-note text-footnote section-header">{children}</h2>
    </IonText>
  )
}
