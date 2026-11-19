import { PagePlaceholder } from '../../components/PagePlaceholder'

export function OrdersPage() {
  return (
    <PagePlaceholder
      title="Orders"
      owner="R6 Frontend & Delivery"
      todo={[
        "Order list with status filters",
        "Order detail + status timeline",
      ]}
    />
  )
}
