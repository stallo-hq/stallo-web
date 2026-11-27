import * as Menu from '@radix-ui/react-dropdown-menu'
import { Eye, EyeOff, LayoutGrid, List, MoreHorizontal, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PageSpinner } from '../../components/ui/Spinner'
import { Segmented } from '../../components/ui/Segmented'
import { cx } from '../../lib/cx'
import { errorMessage } from '../../lib/errors'
import { formatCedis } from '../../lib/money'
import { ProductDialog } from './ProductDialog'
import styles from './ProductsPage.module.css'
import { LOW_STOCK, stockStatus, useProducts, type Product } from './useProducts'

type ProductFilter = 'all' | 'active' | 'low' | 'hidden'

function ProductActions({
  product,
  onEdit,
  onToggle,
  onDelete,
}: {
  product: Product
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.menuTrigger} aria-label={`Actions for ${product.name}`}>
        <MoreHorizontal size={18} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className={styles.menu} align="end" sideOffset={4}>
          <Menu.Item className={styles.menuItem} onSelect={onEdit}>
            <Pencil size={16} /> Edit
          </Menu.Item>
          <Menu.Item className={styles.menuItem} onSelect={onToggle}>
            {product.active ? <EyeOff size={16} /> : <Eye size={16} />}
            {product.active ? 'Hide from customers' : 'Make available'}
          </Menu.Item>
          <Menu.Separator className={styles.menuSeparator} />
          <Menu.Item className={`${styles.menuItem} ${styles.danger}`} onSelect={onDelete}>
            <Trash2 size={16} /> Delete
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function ProductsPage() {
  const { products, create, update, remove, uploadPhoto } = useProducts()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProductFilter>('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
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
    return (products ?? []).filter((p) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && p.active) ||
        (filter === 'low' && p.active && p.stock <= LOW_STOCK) ||
        (filter === 'hidden' && !p.active)
      return matchesFilter && p.name.toLowerCase().includes(q)
    })
  }, [products, search, filter])

  const lowCount = (products ?? []).filter((p) => p.active && p.stock <= LOW_STOCK).length
  const activeCount = (products ?? []).filter((p) => p.active).length
  const hiddenCount = (products ?? []).filter((p) => !p.active).length
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
      : 'Manage the items customers can order from your WhatsApp shop.'

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description={description}
        actions={
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => openEditor(null)}>
            Add product
          </Button>
        }
      />

      {products === undefined ? (
        <PageSpinner />
      ) : products.length === 0 ? (
        <Card>
          <div className={styles.emptyCatalog}>
            <span className={styles.emptyCatalogIcon}>
              <Package size={23} />
            </span>
            <div className={styles.emptyCatalogCopy}>
              <h2>Start your product catalog</h2>
              <p>Add clear names, prices and stock so customers can order the right items in WhatsApp.</p>
            </div>
            <Button variant="primary" icon={<Plus size={17} />} onClick={() => openEditor(null)}>
              Add your first product
            </Button>
          </div>
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
              {search && (
                <button type="button" className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
            <div className={styles.toolbarTools}>
              <span className={styles.resultCount}>
                {visible.length === products.length ? `${products.length} products` : `${visible.length} of ${products.length}`}
              </span>
              <div className={styles.viewToggle} role="group" aria-label="Product layout">
                <button
                  type="button"
                  className={cx(styles.viewButton, view === 'list' && styles.viewSelected)}
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                >
                  <List size={17} />
                </button>
                <button
                  type="button"
                  className={cx(styles.viewButton, view === 'grid' && styles.viewSelected)}
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => setView('grid')}
                >
                  <LayoutGrid size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className={styles.filters}>
            <Segmented
              label="Filter products"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: products.length },
                { value: 'active', label: 'Active', count: activeCount },
                { value: 'low', label: 'Low stock', count: lowCount },
                { value: 'hidden', label: 'Hidden', count: hiddenCount },
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <div className={styles.noMatch}>
              <Package size={22} />
              <span>
                {search.trim() ? `No products match “${search.trim()}”.` : 'No products in this view.'}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch('')
                  setFilter('all')
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : view === 'grid' ? (
            <div className={styles.productGrid}>
              {visible.map((p) => {
                const status = stockStatus(p)
                return (
                  <article key={p._id} className={styles.productCard}>
                    <button
                      type="button"
                      className={styles.productPhoto}
                      onClick={() => openEditor(p)}
                      aria-label={`Edit ${p.name}`}
                    >
                      {p.photoUrl ? <img src={p.photoUrl} alt="" loading="lazy" /> : <Package size={24} />}
                      {!p.active && <span className={styles.photoFlag}>Hidden</span>}
                    </button>
                    <div className={styles.productCardBody}>
                      <div className={styles.productCardHeading}>
                        <button type="button" className={styles.productCardName} onClick={() => openEditor(p)}>
                          {p.name}
                        </button>
                        <ProductActions
                          product={p}
                          onEdit={() => openEditor(p)}
                          onToggle={() => void toggleActive(p)}
                          onDelete={() => setDeleting(p)}
                        />
                      </div>
                      <div className={styles.productCardMeta}>
                        <strong className="num">{formatCedis(p.pricePesewas)}</strong>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
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
                      <ProductActions
                        product={p}
                        onEdit={() => openEditor(p)}
                        onToggle={() => void toggleActive(p)}
                        onDelete={() => setDeleting(p)}
                      />
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
