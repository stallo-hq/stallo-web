import { IonIcon, IonText } from '@ionic/react'
import { bicycleOutline, cashOutline, hourglassOutline, receiptOutline } from 'ionicons/icons'
import { formatCedis } from '../../lib/money'

type Stats = {
  ordersToday: number
  paidTodayPesewas: number
  awaitingPayment: number
  toDeliver: number
}

export function StatTiles({ stats }: { stats: Stats }) {
  const tiles = [
    { label: 'Orders today', value: String(stats.ordersToday), icon: receiptOutline },
    { label: 'Paid today', value: formatCedis(stats.paidTodayPesewas), icon: cashOutline },
    { label: 'Awaiting payment', value: String(stats.awaitingPayment), icon: hourglassOutline },
    { label: 'To deliver', value: String(stats.toDeliver), icon: bicycleOutline },
  ]

  return (
    <div className="stat-grid" role="list" aria-label="Today at a glance">
      {tiles.map((t) => (
        <div className="stat-tile" role="listitem" key={t.label}>
          <IonText color="medium">
            <p className="stat-label text-footnote">
              <IonIcon icon={t.icon} aria-hidden="true" />
              {t.label}
            </p>
          </IonText>
          <p className="stat-value text-title2">{t.value}</p>
        </div>
      ))}
    </div>
  )
}
