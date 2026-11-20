import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useCallback } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Tone } from '../../components/ui/Badge'
import { shrinkImage } from '../../lib/images'

export type Product = FunctionReturnType<typeof api.products.list>[number]
export type ProductInput = {
  name: string
  pricePesewas: number
  stock: number
  active: boolean
  /** Leave out to keep the photo, null to remove it. */
  photoId?: Id<'_storage'> | null
}

/** Stock at or below this is flagged as low. */
export const LOW_STOCK = 5

export function useProducts() {
  const products = useQuery(api.products.list)
  const create = useMutation(api.products.create)
  const update = useMutation(api.products.update)
  const remove = useMutation(api.products.remove)
  const generateUploadUrl = useMutation(api.products.generateUploadUrl)

  /** Shrinks and uploads a photo; returns its storage id for create/update. */
  const uploadPhoto = useCallback(
    async (file: File): Promise<Id<'_storage'>> => {
      const image = await shrinkImage(file)
      const url = await generateUploadUrl({})
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': image.type }, body: image })
      if (!response.ok) throw new Error('The photo didn’t upload. Try again.')
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> }
      return storageId
    },
    [generateUploadUrl],
  )

  return { products, create, update, remove, uploadPhoto }
}

/** One line describing availability, with the colour to show it in. */
export function stockStatus(p: Pick<Product, 'stock' | 'active'>): { label: string; tone: Tone } {
  if (!p.active) return { label: 'Hidden', tone: 'gray' }
  if (p.stock === 0) return { label: 'Out of stock', tone: 'red' }
  if (p.stock <= LOW_STOCK) return { label: `Low · ${p.stock} left`, tone: 'amber' }
  return { label: `${p.stock} in stock`, tone: 'green' }
}
