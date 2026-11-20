import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  attentionType,
  cashStatus,
  paymentMethod,
  conversationState,
  deliveryStatus,
  messageChannel,
  onboardingState,
  orderStatus,
  payoutType,
  paymentStatus,
  processingStatus,
} from './lib/validators'

// Money is always an integer in pesewas. Phone numbers are E.164 (+233...).

export default defineSchema({
  // App users. Credentials and sessions live in the Convex Auth components.
  users: defineTable({
    createdAt: v.number(),
    // Set once the user proves they hold the phone number (SMS code). Nothing works before.
    phoneVerifiedAt: v.optional(v.number()),
  }),

  // SMS one-time codes (sent and checked by SasuSync). A verified code yields a
  // one-time token (stored hashed) that proves phone ownership for a short time.
  phoneVerifications: defineTable({
    phone: v.string(),
    status: v.union(v.literal('sending'), v.literal('sent'), v.literal('failed'), v.literal('verified'), v.literal('used')),
    otpId: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index('by_phone', ['phone'])
    .index('by_token_hash', ['tokenHash']),

  sellers: defineTable({
    ownerId: v.id('users'),
    businessName: v.string(),
    phone: v.string(),
    onboarding: onboardingState,
    whatsappPhoneNumberId: v.optional(v.string()),
    whatsappBusinessAccountId: v.optional(v.string()),
    whatsappDisplayPhone: v.optional(v.string()),
    whatsappConnectedAt: v.optional(v.number()),
    paystackSubaccountCode: v.optional(v.string()),
    payout: v.optional(
      v.object({
        type: payoutType,
        providerName: v.string(),
        accountLast4: v.string(),
        accountName: v.optional(v.string()),
      }),
    ),
    // Orders are numbered per seller, starting at 1001.
    nextOrderNumber: v.optional(v.number()),
    // Pilot: sellers ask the Stallo team to connect WhatsApp / payouts with them.
    whatsappSetupRequestedAt: v.optional(v.number()),
    payoutsSetupRequestedAt: v.optional(v.number()),
    // Platform fee for this seller; falls back to the deployment default when unset.
    feePercent: v.optional(v.number()),
    feeFlatPesewas: v.optional(v.number()),
    // Free text, e.g. "Madina, Adenta, Legon, East Legon". Used to flag addresses outside it.
    deliveryAreas: v.optional(v.string()),
    // Added to every order; paid by the customer. 0 or unset = free delivery.
    deliveryFeePesewas: v.optional(v.number()),
    // Customers may choose to pay the rider in cash.
    acceptsCash: v.optional(v.boolean()),
    // Stallo fees earned minus fees collected through Paystack. Positive = the seller owes
    // Stallo (from cash orders); it is taken from later online payments.
    feeBalancePesewas: v.optional(v.number()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_whatsapp_phone_number_id', ['whatsappPhoneNumberId']),

  // Server-only credentials per seller. Never returned by any public function.
  sellerSecrets: defineTable({
    sellerId: v.id('sellers'),
    whatsappToken: v.optional(v.string()),
  }).index('by_seller', ['sellerId']),

  products: defineTable({
    sellerId: v.id('sellers'),
    name: v.string(),
    pricePesewas: v.number(),
    stock: v.number(),
    active: v.boolean(),
    photoId: v.optional(v.id('_storage')),
    // What the photo shows, written by the AI once per upload, used to match customers' pictures.
    photoDescription: v.optional(v.string()),
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
    // Recent turns, newest last, so the assistant has context. Capped in model/conversation.ts.
    history: v.optional(
      v.array(v.object({ from: v.union(v.literal('customer'), v.literal('stallo')), text: v.string(), at: v.number() })),
    ),
  }).index('by_seller_and_customer', ['sellerId', 'customerId']),

  inboundMessages: defineTable({
    whatsappMessageId: v.string(),
    sellerId: v.optional(v.id('sellers')),
    // The WhatsApp number it was sent to, and who sent it (E.164).
    phoneNumberId: v.optional(v.string()),
    from: v.optional(v.string()),
    profileName: v.optional(v.string()),
    raw: v.any(),
    // A picture the customer sent, copied from WhatsApp so the seller can see it.
    mediaId: v.optional(v.id('_storage')),
    status: processingStatus,
    attempts: v.number(),
    lastAttemptAt: v.optional(v.number()),
    error: v.optional(v.string()),
    receivedAt: v.number(),
  })
    .index('by_whatsapp_message_id', ['whatsappMessageId'])
    .index('by_status_and_received', ['status', 'receivedAt'])
    .index('by_number_and_from', ['phoneNumberId', 'from', 'receivedAt']),

  orders: defineTable({
    sellerId: v.id('sellers'),
    customerId: v.id('customers'),
    number: v.optional(v.number()),
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
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    // Ghana Post digital address found in the address, e.g. GA-183-8164.
    digitalAddress: v.optional(v.string()),
    // When the order is for someone else.
    recipientName: v.optional(v.string()),
    recipientPhone: v.optional(v.string()),
    // The assistant thinks the address is outside the seller's delivery areas.
    outsideDeliveryArea: v.optional(v.boolean()),
    // Part of totalPesewas; Stallo's fee is on the goods only.
    deliveryFeePesewas: v.optional(v.number()),
    paymentMethod: v.optional(paymentMethod),
    // Cash orders: the goods are paid to the rider; any delivery fee is paid online first.
    cashDuePesewas: v.optional(v.number()),
    cashStatus: v.optional(cashStatus),
    deliveryId: v.optional(v.id('deliveries')),
    paymentUrl: v.optional(v.string()),
    note: v.optional(v.string()),
    timeline: v.array(v.object({ status: orderStatus, at: v.number(), note: v.optional(v.string()) })),
    createdAt: v.number(),
  })
    .index('by_seller_and_created', ['sellerId', 'createdAt'])
    .index('by_seller_and_status', ['sellerId', 'status']),

  payments: defineTable({
    orderId: v.id('orders'),
    sellerId: v.optional(v.id('sellers')),
    feePesewas: v.optional(v.number()),
    reference: v.string(),
    amountPesewas: v.number(),
    status: paymentStatus,
    rawEvent: v.optional(v.any()),
  })
    .index('by_reference', ['reference'])
    .index('by_order', ['orderId'])
    .index('by_status', ['status']),

  deliveries: defineTable({
    orderId: v.id('orders'),
    sellerId: v.optional(v.id('sellers')),
    riderName: v.string(),
    riderPhone: v.string(),
    pinHash: v.string(),
    // The rider's no-login page link is /r/<token>; only its hash is stored.
    riderTokenHash: v.optional(v.string()),
    attempts: v.number(),
    status: deliveryStatus,
    notes: v.optional(v.string()),
    dispatchedAt: v.optional(v.number()),
    // What the seller agreed to pay the rider. Paid in person, or kept from the cash collected.
    riderFeePesewas: v.optional(v.number()),
    riderFeeFromCash: v.optional(v.boolean()),
    closedAt: v.optional(v.number()),
  })
    .index('by_order', ['orderId'])
    .index('by_rider_token', ['riderTokenHash'])
    .index('by_seller_rider_status', ['sellerId', 'riderPhone', 'status']),

  attentionItems: defineTable({
    sellerId: v.id('sellers'),
    type: attentionType,
    orderId: v.optional(v.id('orders')),
    inboundMessageId: v.optional(v.id('inboundMessages')),
    summary: v.string(),
    resolved: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_seller_and_resolved', ['sellerId', 'resolved'])
    .index('by_order', ['orderId']),

  outboundMessages: defineTable({
    sellerId: v.id('sellers'),
    channel: v.optional(messageChannel),
    recipient: v.string(),
    // Free-form text, used inside the 24-hour window. The template is the fallback outside it.
    text: v.optional(v.string()),
    template: v.optional(v.string()),
    templateParams: v.optional(v.array(v.string())),
    orderId: v.optional(v.id('orders')),
    status: processingStatus,
    attempts: v.optional(v.number()),
    whatsappMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_seller', ['sellerId'])
    .index('by_whatsapp_message_id', ['whatsappMessageId']),
})
