import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/react'
import { ConvexError } from 'convex/values'
import { useRef, useState, type FormEvent } from 'react'
import { SectionFooter } from '../../components/SectionFooter'
import { inputValue } from '../../lib/forms'
import { haptic } from '../../lib/haptics'
import { parseCedis, pesewasToInput } from '../../lib/money'
import type { Product, ProductInput } from './useProducts'

/**
 * Add or edit a product in a sheet. Same form for both (`product` set = edit).
 * Shown as a sheet on phones and a centred dialog on wide screens.
 */
export function ProductForm({
  isOpen,
  product,
  onSave,
  onDeleteRequest,
  onClose,
}: {
  isOpen: boolean
  product: Product | null
  onSave: (input: ProductInput) => Promise<unknown>
  /** Edit mode only: ask to delete this product. */
  onDeleteRequest: () => void
  onClose: () => void
}) {
  const nameRef = useRef<HTMLIonInputElement>(null)
  const priceRef = useRef<HTMLIonInputElement>(null)
  const stockRef = useRef<HTMLIonInputElement>(null)
  const [active, setActive] = useState(product?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const formId = 'product-form'

  function validate(): ProductInput | string {
    const name = inputValue(nameRef).trim()
    if (!name) return 'Enter a name.'
    const pricePesewas = parseCedis(inputValue(priceRef))
    if (pricePesewas === null) return 'Enter a price, for example 45 or 45.50.'
    const stockText = inputValue(stockRef).trim()
    const stock = stockText === '' ? 0 : Number(stockText)
    if (!Number.isInteger(stock) || stock < 0) return 'Stock must be a whole number, 0 or more.'
    return { name, pricePesewas, stock, active }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = validate()
    if (typeof result === 'string') {
      haptic('error')
      setError(result)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(result)
      haptic('success')
      onClose()
    } catch (err) {
      haptic('error')
      setError(err instanceof ConvexError ? String(err.data) : 'Couldn’t save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      onWillPresent={() => {
        setActive(product?.active ?? true)
        setError(null)
      }}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>{product ? 'Edit product' : 'New product'}</IonTitle>
          <IonButtons slot="end">
            <IonButton type="submit" form={formId} strong disabled={saving}>
              Save
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent color="light">
        <form id={formId} onSubmit={submit} noValidate>
          {/* A hidden submit button lets Enter submit from any field. */}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          <IonList inset className="ion-margin-top">
            <IonItem>
              <IonInput
                ref={nameRef}
                label="Name"
                labelPlacement="fixed"
                placeholder="Jollof with chicken"
                value={product?.name ?? ''}
                maxlength={80}
                autocapitalize="sentences"
              />
            </IonItem>
            <IonItem>
              <IonInput
                ref={priceRef}
                label="Price (GH₵)"
                labelPlacement="fixed"
                placeholder="0.00"
                inputmode="decimal"
                value={product ? pesewasToInput(product.pricePesewas) : ''}
              />
            </IonItem>
            <IonItem>
              <IonInput
                ref={stockRef}
                label="In stock"
                labelPlacement="fixed"
                placeholder="0"
                inputmode="numeric"
                value={product ? String(product.stock) : ''}
              />
            </IonItem>
            <IonItem>
              <IonToggle
                checked={active}
                onIonChange={(e) => {
                  setActive(e.detail.checked)
                  haptic('light')
                }}
              >
                <IonLabel>Available to order</IonLabel>
              </IonToggle>
            </IonItem>
          </IonList>
          {error ? (
            <SectionFooter color="danger">{error}</SectionFooter>
          ) : (
            <SectionFooter>
              Customers are always charged this price. Turn off “Available to order” to hide it without deleting it.
            </SectionFooter>
          )}

          {product && (
            <IonList inset>
              <IonItem button detail={false} onClick={onDeleteRequest}>
                <IonLabel color="danger">Delete product</IonLabel>
              </IonItem>
            </IonList>
          )}
        </form>
      </IonContent>
    </IonModal>
  )
}
