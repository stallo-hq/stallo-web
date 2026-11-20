import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Messages that weren't processed (e.g. the assistant was down) are retried; after 3 tries they go to Needs attention.
crons.interval('retry stuck WhatsApp messages', { minutes: 2 }, internal.inbound.retryStuck, {})

// 20:00 in Accra (Ghana is UTC+0 all year).
crons.interval('check unpaid payment links with Paystack', { minutes: 5 }, internal.payments.checkPending, {})

crons.daily('daily summary to sellers', { hourUTC: 20, minuteUTC: 0 }, internal.summary.sendDaily, {})

export default crons
