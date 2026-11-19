import { PagePlaceholder } from '../../components/PagePlaceholder'

export function ExceptionsPage() {
  return (
    <PagePlaceholder
      title="Needs attention"
      owner="R6 Frontend & Delivery"
      todo={[
        "Low-confidence orders to confirm",
        "Stock gaps, failed payments, disconnects",
      ]}
    />
  )
}
