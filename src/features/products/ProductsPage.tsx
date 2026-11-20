import * as Menu from '@radix-ui/react-dropdown-menu'
import { Eye, EyeOff, MoreHorizontal, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageSpinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatCedis } from '../../lib/money'
import { ProductDialog } from './ProductDialog'
import styles from './ProductsPage.module.css'
import { LOW_STOCK, stockStatus, useProducts, type Product } from './useProducts'

export function ProductsPage() {
  const { products, create, update, remove, uploadPhoto } = useProducts()
  const [search, setSearch] = useState('')
  // `product` stays set while the dialog animates closed, so its title doesn't flicker.
  // `version` gives each opening a fresh form.
  const [editor, setEditor] = useState<{ open: boolean; product: Product | null; version: number }>({
    open: false,
    product: null,
    version: 0,
  })
  const [deleting, setDeleting] = useState<Product | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (products ?? []).filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const lowCount = (products ?? []).filter((p) => p.active && p.stock <= LOW_STOCK).length
  const openEditor = (product: Product | null) => setEditor((e) => ({ open: true, product, version: e.version + 1 }))

  async function toggleActive(p: Product) {
    try {
      await update({ productId: p._id, name: p.name, pricePesewas: p.pricePesewas, stock: p.stock, active: !p.active })
      toast.success(p.active ? `${p.name} is hidden from customers` : `${p.name} is available again`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const description =
    products && products.length > 0
      ? `${products.length} ${products.length === 1 ? 'product' : 'products'}${lowCount > 0 ? ` · ${lowCount} low or out of stock` : ''}`
      : 'What you sell and what it costs. Stallo only ever charges these prices.'

  return (
    <>
      <PageHeader
        title="Products"
        description={description}
        actions={
          <Button variant="dark" icon={<Plus size={17} />} onClick={() => openEditor(null)}>
            Add product
          </Button>
        }
      />

      {products === undefined ? (
        <PageSpinner />
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="Add your first product"
            action={
              <Button variant="dark" icon={<Plus size={17} />} onClick={() => openEditor(null)}>
                Add product
              </Button>
            }
          >
            Stallo matches what customers ask for in WhatsApp to these names and prices.
          </EmptyState>
        </Card>
      ) : (
        <Card flush>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                type="search"
                placeholder="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search products"
              />
            </label>
          </div>
          {visible.length === 0 ? (
            <p className={styles.noMatch}>No products match “{search.trim()}”.</p>
          ) : (
            <div role="table" aria-label="Products">
              <div className={styles.head} role="row">
                <span role="columnheader">Product</span>
                <span role="columnheader">Stock</span>
                <span role="columnheader" className={styles.right}>
                  Price
                </span>
                <span role="columnheader" className="visually-hidden">
                  Actions
                </span>
              </div>
              {visible.map((p) => {
                const status = stockStatus(p)
                return (
                  <div key={p._id} className={styles.row} role="row">
                    <button type="button" className={styles.name} onClick={() => openEditor(p)} role="cell">
                      <span className={styles.thumb}>
                        {p.photoUrl ? <img src={p.photoUrl} alt="" loading="lazy" /> : p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className={p.active ? undefined : styles.hiddenName}>{p.name}</span>
                    </button>
                    <span role="cell">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </span>
                    <span role="cell" className={`${styles.right} num`}>
                      {formatCedis(p.pricePesewas)}
                    </span>
                    <span role="cell" className={styles.menuCell}>
                      <Menu.Root>
                        <Menu.Trigger className={styles.menuTrigger} aria-label={`Actions for ${p.name}`}>
                          <MoreHorizontal size={18} />
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Content className={styles.menu} align="end" sideOffset={4}>
                            <Menu.Item className={styles.menuItem} onSelect={() => openEditor(p)}>
                              <Pencil size={16} /> Edit
                            </Menu.Item>
                            <Menu.Item className={styles.menuItem} onSelect={() => void toggleActive(p)}>
                              {p.active ? <EyeOff size={16} /> : <Eye size={16} />}
                              {p.active ? 'Hide from customers' : 'Make available'}
                            </Menu.Item>
                            <Menu.Separator className={styles.menuSeparator} />
                            <Menu.Item className={`${styles.menuItem} ${styles.danger}`} onSelect={() => setDeleting(p)}>
                              <Trash2 size={16} /> Delete
                            </Menu.Item>
                          </Menu.Content>
                        </Menu.Portal>
                      </Menu.Root>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <ProductDialog
        key={editor.version}
        open={editor.open}
        product={editor.product}
        uploadPhoto={uploadPhoto}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        onSave={async (input) => {
          if (editor.product) {
            await update({ productId: editor.product._id, ...input })
            toast.success('Product saved')
          } else {
            await create(input)
            toast.success(`${input.name.trim()} added`)
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'product'}?`}
        description="Past orders keep their details. This can’t be undone. To stop selling it for now, hide it instead."
        confirmLabel="Delete product"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove({ productId: deleting._id })
            toast.success(`${deleting.name} deleted`)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </>
  )
}
