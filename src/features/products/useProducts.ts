import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import type { Tone } from '../../components/ui/Badge'

export type Product = FunctionReturnType<typeof api.products.list>[number]
export type ProductInput = { name: string; pricePesewas: number; stock: number; active: boolean }

/** Stock at or below this is flagged as low. */
export const LOW_STOCK = 5

export function useProducts() {
  const products = useQuery(api.products.list)
  const create = useMutation(api.products.create)
  const update = useMutation(api.products.update)
  const remove = useMutation(api.products.remove)
  return { products, create, update, remove }
}

/** One line describing availability, with the colour to show it in. */
export function stockStatus(p: Pick<Product, 'stock' | 'active'>): { label: string; tone: Tone } {
  if (!p.active) return { label: 'Hidden', tone: 'gray' }
  if (p.stock === 0) return { label: 'Out of stock', tone: 'red' }
  if (p.stock <= LOW_STOCK) return { label: `Low · ${p.stock} left`, tone: 'amber' }
  return { label: `${p.stock} in stock`, tone: 'green' }
}
