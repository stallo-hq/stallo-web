import {
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonText,
} from '@ionic/react'
import { add, cubeOutline, searchOutline } from 'ionicons/icons'
import { useMemo, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { LargeTitlePage } from '../../components/LargeTitlePage'
import { SectionHeader } from '../../components/SectionHeader'
import { formatCedis } from '../../lib/money'
import { ProductForm } from './ProductForm'
import {
  LOW_STOCK,
  stockStatus,
  useConfirmDeleteProduct,
  useProducts,
  type Product,
} from './useProducts'

export function ProductsPage() {
  const { products, create, update } = useProducts()
  const confirmDelete = useConfirmDeleteProduct()
  const [search, setSearch] = useState('')
  // `product` is kept while the dialog animates closed, so its title and fields don't flicker.
  const [form, setForm] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  })
  const openForm = (product: Product | null) => setForm({ open: true, product })
  const closeForm = () => setForm((f) => ({ ...f, open: false }))

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (products ?? []).filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const lowCount = (products ?? []).filter((p) => p.active && p.stock <= LOW_STOCK).length
  const openNew = () => openForm(null)

  const summary =
    products && products.length > 0
      ? `${products.length} ${products.length === 1 ? 'product' : 'products'}${
          lowCount > 0 ? ` · ${lowCount} low or out of stock` : ''
        }`
      : undefined

  return (
    <LargeTitlePage
      title="Products"
      subtitle={summary ?? 'What you sell and what it costs.'}
      toolbarEnd={
        <IonButtons slot="end">
          <IonButton onClick={openNew} aria-label="Add product">
            <IonIcon slot="start" icon={add} />
            Add
          </IonButton>
        </IonButtons>
      }
    >
      {products === undefined ? (
        <div className="centered ion-padding">
          <IonSpinner aria-label="Loading" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={cubeOutline}
          title="Add your first product"
          message="Stallo uses these names and prices to build orders from your customers’ messages."
          actionLabel="Add product"
          onAction={openNew}
        />
      ) : (
        <>
          <div className="toolbar-gap">
            <IonSearchbar
              value={search}
              onIonInput={(e) => setSearch(e.detail.value ?? '')}
              placeholder="Search products"
              searchIcon={searchOutline}
            />
          </div>
          {visible.length === 0 ? (
            <IonText color="medium">
              <p className="ion-text-center text-subheadline">No products match “{search.trim()}”.</p>
            </IonText>
          ) : (
            <>
              <SectionHeader detail="Tap to edit">All products</SectionHeader>
              <IonList inset>
                {visible.map((p) => {
                  const status = stockStatus(p)
                  return (
                    <IonItemSliding key={p._id}>
                      <IonItem button detail onClick={() => openForm(p)}>
                        <IonLabel>
                          <h2 className="truncate">{p.name}</h2>
                          <IonText color={status.color}>
                            <p>{status.text}</p>
                          </IonText>
                        </IonLabel>
                        <IonNote slot="end" className="amount">
                          {formatCedis(p.pricePesewas)}
                        </IonNote>
                      </IonItem>
                      <IonItemOptions side="end">
                        <IonItemOption color="danger" onClick={() => confirmDelete(p)}>
                          Delete
                        </IonItemOption>
                      </IonItemOptions>
                    </IonItemSliding>
                  )
                })}
              </IonList>
            </>
          )}
        </>
      )}

      <ProductForm
        isOpen={form.open}
        product={form.product}
        onClose={closeForm}
        onSave={(input) =>
          form.product ? update({ productId: form.product._id, ...input }) : create(input)
        }
        onDeleteRequest={() => {
          if (form.product) confirmDelete(form.product, closeForm)
        }}
      />
    </LargeTitlePage>
  )
}
