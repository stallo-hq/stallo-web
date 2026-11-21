import { Link } from 'react-router'
import { CONTACT_EMAIL, LegalPage } from './LegalPage'

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="These terms apply when a business uses Stallo to take orders on WhatsApp, get paid and arrange delivery. By creating an account you agree to them."
    >
      <h2>What Stallo does</h2>
      <p>
        Stallo reads the messages customers send to your WhatsApp number, builds their order from your product list, sends a Paystack payment
        link, and helps you deliver with a delivery code. You sell your own products: the sale is between you and your customer. Stallo is not
        a party to it and does not own, hold or ship your goods.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 and able to run a business in Ghana.</li>
        <li>Keep your password private. You are responsible for what is done with your account.</li>
        <li>The information you give us, including your business name and payout details, must be accurate.</li>
      </ul>

      <h2>What you agree to</h2>
      <ul>
        <li>Sell only lawful goods and services, and describe them honestly.</li>
        <li>Keep your prices and stock up to date. Customers are charged the prices in your product list.</li>
        <li>Deliver what customers pay for, or cancel and refund them.</li>
        <li>Follow WhatsApp’s and Paystack’s own rules, and only message people who have contacted you or agreed to hear from you.</li>
        <li>Handle your customers’ information carefully and only to serve their orders.</li>
      </ul>

      <h2>Riders</h2>
      <p>
        Riders are chosen by you. Any rider fee is agreed between you and the rider; Stallo only shows the amount you enter and does not pay
        riders. You are responsible for the people you send orders with.
      </p>

      <h2>Payments and fees</h2>
      <ul>
        <li>Online payments are processed by Paystack and paid to your payout account under Paystack’s terms and timing.</li>
        <li>
          Stallo charges a fee on each order, on the goods only and not on your delivery fee. The current fee is shown on our website and in
          your dashboard. Paystack’s own processing fee also applies.
        </li>
        <li>
          If you accept cash on delivery, Stallo’s fee on those orders is recorded when the cash is collected and taken from your later online
          payments, never more than half of any one payment. Cash may be paused while fees are owed.
        </li>
        <li>Refunds are started by you from the order page and returned through Paystack. You are responsible for refunds you owe.</li>
        <li>We will tell you before we change the fee. Changes apply only to orders after the change.</li>
      </ul>

      <h2>Automated replies</h2>
      <p>
        Stallo uses AI to understand messages and pictures. It can make mistakes. When it is unsure it asks you to step in, but you should check
        your orders and the Needs attention list, and reply to customers when needed.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep Stallo running, but it depends on services we do not control, including WhatsApp, Paystack, SMS networks and hosting
        providers. Stallo may sometimes be unavailable or delayed, and features may change as the product grows.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can stop using Stallo at any time by emailing us. We may suspend or close an account that breaks these terms, puts customers at
        risk, or is used for fraud. Fees already owed remain owed.
      </p>

      <h2>Liability</h2>
      <p>
        Stallo is provided as it is. As far as the law allows, we are not responsible for losses from your sales, your products or deliveries,
        or from outages of services we rely on. Nothing in these terms removes rights you have under the law of Ghana.
      </p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of Ghana.</p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We will change the date at the top and tell sellers in the dashboard about important changes. Using Stallo
        after that means you accept them. How we handle personal information is in our <Link to="/privacy">privacy policy</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
