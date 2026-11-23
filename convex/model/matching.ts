import type { Doc } from '../_generated/dataModel'

/**
 * Product matching rules. Small catalogues go to the assistant whole; big ones
 * are cut to the products closest in meaning to the customer's message, so the
 * prompt stays short and the right items are easy to find.
 */

/** Up to this many products, the assistant sees the whole catalogue and no embedding call is made. */
export const SHORTLIST_SIZE = 40

/** What we embed for a product: its name, plus what its photo shows when we know. */
export function productText(product: Pick<Doc<'products'>, 'name' | 'photoDescription'>): string {
  const name = product.name.trim()
  const photo = product.photoDescription?.trim()
  return photo ? `${name}. ${photo}` : name
}

/**
 * The products to show the assistant: everything already in the basket, then the
 * closest matches in order, then the rest of the catalogue, up to `limit`.
 * Without a ranking (matching off or failed) the catalogue is unchanged.
 */
export function shortlist<P extends { id: string }>(products: P[], ranked: string[] | null, keep: ReadonlySet<string>, limit = SHORTLIST_SIZE): P[] {
  if (ranked === null || products.length <= limit) return products
  const byId = new Map(products.map((p) => [p.id, p]))
  const chosen = new Map<string, P>()
  for (const id of [...keep, ...ranked, ...products.map((p) => p.id)]) {
    if (chosen.size >= limit && !keep.has(id)) break
    const product = byId.get(id)
    if (product && !chosen.has(id)) chosen.set(id, product)
  }
  return [...chosen.values()]
}
