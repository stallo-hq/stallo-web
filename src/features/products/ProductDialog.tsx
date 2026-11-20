import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { Switch } from '../../components/ui/Switch'
import { errorMessage } from '../../lib/errors'
import { parseCedis, pesewasToInput } from '../../lib/money'
import styles from './ProductsPage.module.css'
import type { Product, ProductInput } from './useProducts'

type Errors = Partial<Record<'name' | 'price' | 'stock' | 'form', string>>

/** Add or edit a product. `product` null = new. Give it a new `key` each time it opens so the form starts fresh. */
export function ProductDialog({
  open,
  product,
  onOpenChange,
  onSave,
}: {
  open: boolean
  product: Product | null
  onOpenChange: (open: boolean) => void
  onSave: (input: ProductInput) => Promise<unknown>
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? pesewasToInput(product.pricePesewas) : '')
  const [stock, setStock] = useState(product ? String(product.stock) : '')
  const [active, setActive] = useState(product?.active ?? true)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

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
      await onSave({ name, pricePesewas, stock: stockCount, active })
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
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="dark" loading={busy}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
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
    </Dialog>
  )
}
