import { PagePlaceholder } from '../../components/PagePlaceholder'

export function DashboardPage() {
  return (
    <PagePlaceholder
      title="Dashboard"
      owner="R5 Frontend Architecture"
      todo={[
        "Today's sales, orders, pending payments",
        "WhatsApp connection status",
      ]}
    />
  )
}
