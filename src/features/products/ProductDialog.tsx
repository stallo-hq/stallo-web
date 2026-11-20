import { ImagePlus } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { Switch } from '../../components/ui/Switch'
import { errorMessage } from '../../lib/errors'
import { parseCedis, pesewasToInput } from '../../lib/money'
import styles from './ProductsPage.module.css'
import type { Product, ProductInput } from './useProducts'

type Errors = Partial<Record<'name' | 'price' | 'stock' | 'photo' | 'form', string>>

/** null = keep the current photo; 'removed' = take it off; a file = replace it. */
type PhotoChange = null | 'removed' | { file: File; preview: string }

const MAX_PICK_BYTES = 20 * 1024 * 1024

/** Add or edit a product. `product` null = new. Give it a new `key` each time it opens so the form starts fresh. */
export function ProductDialog({
  open,
  product,
  onOpenChange,
  onSave,
  uploadPhoto,
}: {
  open: boolean
  product: Product | null
  uploadPhoto: (file: File) => Promise<Id<'_storage'>>
  onOpenChange: (open: boolean) => void
  onSave: (input: ProductInput) => Promise<unknown>
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? pesewasToInput(product.pricePesewas) : '')
  const [stock, setStock] = useState(product ? String(product.stock) : '')
  const [active, setActive] = useState(product?.active ?? true)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<PhotoChange>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const previewUrl = photo === 'removed' ? null : photo ? photo.preview : (product?.photoUrl ?? null)

  useEffect(() => {
    // Free the preview's memory when it's replaced or the dialog closes.
    return () => {
      if (photo && photo !== 'removed') URL.revokeObjectURL(photo.preview)
    }
  }, [photo])

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setErrors((x) => ({ ...x, photo: 'Choose a photo (JPG or PNG).' }))
    if (file.size > MAX_PICK_BYTES) return setErrors((x) => ({ ...x, photo: 'That photo is too large.' }))
    setErrors((x) => ({ ...x, photo: undefined }))
    setPhoto({ file, preview: URL.createObjectURL(file) })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    const pricePesewas = parseCedis(price)
    const stockCount = Number(stock)
    if (name.trim() === '') next.name = 'Enter a name.'
    if (pricePesewas === null) next.price = 'Enter a price, for example 25 or 25.50.'
    if (stock.trim() === '' || !Number.isInteger(stockCount) || stockCount < 0) next.stock = 'Enter a whole number, 0 or more.'
    setErrors(next)
    if (Object.keys(next).length > 0 || pricePesewas === null) return

    setBusy(true)
    try {
      const photoId = photo === 'removed' ? null : photo ? await uploadPhoto(photo.file) : undefined
      await onSave({ name, pricePesewas, stock: stockCount, active, ...(photoId !== undefined ? { photoId } : {}) })
      onOpenChange(false)
    } catch (err) {
      setErrors({ form: errorMessage(err, 'Couldn’t save. Try again.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={product ? 'Edit product' : 'Add a product'}
      description="Customers are always charged the price you set here."
      onSubmit={submit}
      size="wide"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="dark" loading={busy}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <div className={styles.editor}>
        <div className={styles.photoColumn}>
          <button
            type="button"
            className={styles.photoPreview}
            onClick={() => fileInput.current?.click()}
            aria-label={previewUrl ? 'Change photo' : 'Add photo'}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" />
            ) : (
              <span className={styles.photoEmpty}>
                <ImagePlus size={28} />
                <span>Add photo</span>
              </span>
            )}
          </button>
          <div className={styles.photoText}>
            <div className={styles.photoActions}>
              <Button size="sm" onClick={() => fileInput.current?.click()}>
                {previewUrl ? 'Change photo' : 'Add photo'}
              </Button>
              {previewUrl && (
                <Button size="sm" variant="ghost" onClick={() => setPhoto(product?.photoUrl ? 'removed' : null)}>
                  Remove
                </Button>
              )}
            </div>
            <span>Helps Stallo recognise this item when a customer sends a picture, like a TikTok screenshot.</span>
            {errors.photo && <span className={styles.formError}>{errors.photo}</span>}
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
        </div>

        <div className={styles.fieldsColumn}>
          <Field
            label="Name"
            placeholder="Jollof with chicken"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            hint="Use the name customers will type, so Stallo can match it."
            autoFocus
          />
          <div className={styles.formRow}>
            <Field
              label="Price"
              prefix="GH₵"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={errors.price}
            />
            <Field
              label="In stock"
              inputMode="numeric"
              placeholder="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              error={errors.stock}
            />
          </div>
          <Switch
            label="Available to order"
            hint="Turn off to hide it from customers without deleting it."
            checked={active}
            onCheckedChange={setActive}
          />
          {errors.form && (
            <p className={styles.formError} role="alert">
              {errors.form}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  )
}
