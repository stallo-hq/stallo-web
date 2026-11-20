import { IonText } from '@ionic/react'

/** iOS grouped-list footer: explanatory footnote under an inset group. */
export function SectionFooter({ children, color = 'medium' }: { children: string; color?: string }) {
  return (
    <IonText color={color}>
      <p className="list-footer text-footnote" role={color === 'danger' ? 'alert' : undefined}>
        {children}
      </p>
    </IonText>
  )
}
