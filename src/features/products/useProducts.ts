import { useIonAlert } from '@ionic/react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import { haptic } from '../../lib/haptics'

export type Product = FunctionReturnType<typeof api.products.list>[number]
export type ProductInput = { name: string; pricePesewas: number; stock: number; active: boolean }

/** Stock at or below this is flagged as low. */
export const LOW_STOCK = 5

export function useProducts() {
  const products = useQuery(api.products.list)
  const create = useMutation(api.products.create)
  const update = useMutation(api.products.update)
  return { products, create, update }
}

/** Ask before deleting, then delete. The one confirmation used wherever a product can be deleted. */
export function useConfirmDeleteProduct() {
  const remove = useMutation(api.products.remove)
  const [presentAlert] = useIonAlert()
  return (product: Product, onDeleted?: () => void) =>
    void presentAlert({
      header: `Delete ${product.name}?`,
      message: 'Past orders keep their details. This can’t be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void remove({ productId: product._id }).then(() => {
              haptic('success')
              onDeleted?.()
            })
          },
        },
      ],
    })
}

/** One line describing availability, with the colour to show it in. */
export function stockStatus(p: Pick<Product, 'stock' | 'active'>): { text: string; color: string } {
  if (!p.active) return { text: 'Hidden from customers', color: 'medium' }
  if (p.stock === 0) return { text: 'Out of stock', color: 'danger' }
  if (p.stock <= LOW_STOCK) return { text: `Low stock · ${p.stock} left`, color: 'warning' }
  return { text: `${p.stock} in stock`, color: 'medium' }
}
