import { PagePlaceholder } from '../../components/PagePlaceholder'

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      owner="R5 Frontend Architecture"
      todo={[
        "Link WhatsApp via QR code",
        "Payment provider keys, business info",
      ]}
    />
  )
}
