import { PagePlaceholder } from '../../components/PagePlaceholder'

export function InventoryPage() {
  return (
    <PagePlaceholder
      title="Inventory"
      owner="R6 Frontend & Delivery"
      todo={[
        "Product list + stock levels",
        "Add / edit products",
      ]}
    />
  )
}
