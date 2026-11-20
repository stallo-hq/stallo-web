import { IonText } from '@ionic/react'

/** iOS grouped-list section header: small, uppercase, secondary colour, above the inset group. */
export function SectionHeader({ children, detail }: { children: string; detail?: string }) {
  return (
    <IonText color="medium">
      <h2 className="list-header-note text-footnote">
        <span className="section-header">{children}</span>
        {detail && <span>{detail}</span>}
      </h2>
    </IonText>
  )
}
