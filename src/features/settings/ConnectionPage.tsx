import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import styles from './ConnectionPage.module.css'
import { connectionStatus } from './connectionStatus'

export type ConnectionCopy = {
  title: string
  description: string
  benefits: { title: string; text: string }[]
  checklist: string[]
}

/** Shared layout for WhatsApp and payouts: status and the form on the left, what it does and what you need on the right. */
export function ConnectionPage({ copy, connected, children }: { copy: ConnectionCopy; connected: boolean; children: ReactNode }) {
  const status = connectionStatus(connected)
  return (
    <>
      <PageHeader title={copy.title} description={copy.description} back={{ to: '/app/settings', label: 'Settings' }} />
      <div className={styles.layout}>
        <Card className={styles.status}>
          <div className={styles.statusHead}>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {children}
        </Card>

        <div className={styles.details}>
          <Card plain title="What you get">
            <ul className={styles.benefits}>
              {copy.benefits.map((b) => (
                <li key={b.title}>
                  <Check size={18} />
                  <div>
                    <strong>{b.title}</strong>
                    <span>{b.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card plain title="Have these ready">
            <ol className={styles.checklist}>
              {copy.checklist.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}
