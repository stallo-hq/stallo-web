import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  attentionType,
  conversationState,
  deliveryStatus,
  onboardingState,
  orderStatus,
  paymentStatus,
  processingStatus,
} from './lib/validators'

// Money is always an integer in pesewas. Phone numbers are E.164 (+233...).

export default defineSchema({
  // App users. Credentials and sessions live in the Convex Auth components.
  users: defineTable({
    createdAt: v.number(),
  }),

  sellers: defineTable({
    ownerId: v.id('users'),
    businessName: v.string(),
    phone: v.string(),
    onboarding: onboardingState,
    whatsappPhoneNumberId: v.optional(v.string()),
    whatsappBusinessAccountId: v.optional(v.string()),
    paystackSubaccountCode: v.optional(v.string()),
    // Platform fee for this seller; falls back to the deployment default when unset.
    feePercent: v.optional(v.number()),
    feeFlatPesewas: v.optional(v.number()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_whatsapp_phone_number_id', ['whatsappPhoneNumberId']),

  products: defineTable({
    sellerId: v.id('sellers'),
    name: v.string(),
    pricePesewas: v.number(),
    stock: v.number(),
    active: v.boolean(),
    photoId: v.optional(v.id('_storage')),
  }).index('by_seller', ['sellerId']),

  customers: defineTable({
    sellerId: v.id('sellers'),
    phone: v.string(),
    name: v.optional(v.string()),
    lastAddress: v.optional(v.string()),
  }).index('by_seller_and_phone', ['sellerId', 'phone']),

  conversations: defineTable({
    sellerId: v.id('sellers'),
    customerId: v.id('customers'),
    state: conversationState,
    draftOrderId: v.optional(v.id('orders')),
    lastInboundAt: v.number(),
  }).index('by_seller_and_customer', ['sellerId', 'customerId']),

  inboundMessages: defineTable({
    whatsappMessageId: v.string(),
    sellerId: v.optional(v.id('sellers')),
    raw: v.any(),
    status: processingStatus,
    attempts: v.number(),
    error: v.optional(v.string()),
    receivedAt: v.number(),
  })
    .index('by_whatsapp_message_id', ['whatsappMessageId'])
    .index('by_status_and_received', ['status', 'receivedAt']),

  orders: defineTable({
    sellerId: v.id('sellers'),
    customerId: v.id('customers'),
    items: v.array(
      v.object({
        productId: v.id('products'),
        name: v.string(),
        unitPricePesewas: v.number(),
        qty: v.number(),
      }),
    ),
    subtotalPesewas: v.number(),
    feePesewas: v.number(),
    totalPesewas: v.number(),
    status: orderStatus,
    paymentStatus: paymentStatus,
    address: v.optional(v.string()),
    deliveryId: v.optional(v.id('deliveries')),
    timeline: v.array(v.object({ status: orderStatus, at: v.number() })),
    createdAt: v.number(),
  })
    .index('by_seller_and_created', ['sellerId', 'createdAt'])
    .index('by_seller_and_status', ['sellerId', 'status']),

  payments: defineTable({
    orderId: v.id('orders'),
    reference: v.string(),
    amountPesewas: v.number(),
    status: paymentStatus,
    rawEvent: v.optional(v.any()),
  })
    .index('by_reference', ['reference'])
    .index('by_order', ['orderId']),

  deliveries: defineTable({
    orderId: v.id('orders'),
    riderName: v.string(),
    riderPhone: v.string(),
    pinHash: v.string(),
    attempts: v.number(),
    status: deliveryStatus,
    notes: v.optional(v.string()),
  }).index('by_order', ['orderId']),

  attentionItems: defineTable({
    sellerId: v.id('sellers'),
    type: attentionType,
    orderId: v.optional(v.id('orders')),
    inboundMessageId: v.optional(v.id('inboundMessages')),
    summary: v.string(),
    resolved: v.boolean(),
    createdAt: v.number(),
  }).index('by_seller_and_resolved', ['sellerId', 'resolved']),

  outboundMessages: defineTable({
    sellerId: v.id('sellers'),
    recipient: v.string(),
    template: v.optional(v.string()),
    text: v.optional(v.string()),
    status: processingStatus,
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_seller', ['sellerId']),
})
