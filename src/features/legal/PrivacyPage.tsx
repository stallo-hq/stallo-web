import { Link } from 'react-router'
import { CONTACT_EMAIL, LegalPage } from './LegalPage'

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="Stallo helps small businesses in Ghana take orders on WhatsApp, get paid and deliver. This page explains what information we handle, why, who we share it with, and the choices you have."
    >
      <h2>Who this covers</h2>
      <ul>
        <li>
          <strong>Sellers:</strong> businesses that create a Stallo account.
        </li>
        <li>
          <strong>Customers:</strong> people who message a seller’s WhatsApp number that uses Stallo.
        </li>
        <li>
          <strong>Riders and receivers:</strong> people a seller sends an order with, and people an order is delivered to.
        </li>
      </ul>
      <p>
        For customers, the seller decides what to sell and who to deliver to. Stallo processes customer information on the seller’s behalf to
        run their orders.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>From sellers:</strong> mobile number, business name, a password (stored only as a secure hash), products, prices, stock and
        product photos, delivery settings, and payout details. Bank or mobile money details are sent to Paystack to set up payouts; Stallo
        keeps only the provider name and the last four digits.
      </p>
      <p>
        <strong>From customers:</strong> WhatsApp number and profile name, the messages and pictures they send to the seller, delivery address,
        location pins and Ghana Post digital addresses they share, and the name and number of anyone they ask us to deliver to.
      </p>
      <p>
        <strong>About orders:</strong> items, amounts, payment status and reference, delivery status, and the rider’s name and number.
      </p>
      <p>
        <strong>Payments:</strong> card and mobile money payments are made on Paystack’s own pages. Stallo never sees or stores card numbers or
        mobile money PINs.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To read customers’ messages, build their order, and reply on the seller’s behalf.</li>
        <li>To create payment links, confirm payments and record refunds.</li>
        <li>To send delivery codes to the customer or receiver, and order details to the rider.</li>
        <li>To verify a seller’s phone number with a one-time SMS code.</li>
        <li>To show sellers their orders, payments and anything that needs their attention.</li>
        <li>To keep the service secure, fix problems and prevent misuse.</li>
      </ul>
      <p>We do not sell personal information, and we do not use it for advertising.</p>

      <h2>Automated reading of messages</h2>
      <p>
        Stallo uses AI services to understand what a customer is asking for, and to compare pictures customers send with the seller’s product
        photos. Prices always come from the seller’s product list, never from the AI. When Stallo is unsure, it does not create the order and
        asks the seller to reply instead.
      </p>

      <h2>Who we share it with</h2>
      <p>Only with the services Stallo needs to work, and only what each one needs:</p>
      <ul>
        <li>
          <strong>WhatsApp (Meta):</strong> messages travel over WhatsApp. Stallo reads and sends them through the seller’s own WhatsApp,
          linked as a device to a server Stallo runs.
        </li>
        <li>
          <strong>Paystack:</strong> to take payments, pay sellers and process refunds.
        </li>
        <li>
          <strong>SasuSync:</strong> to send SMS sign-up codes, delivery codes, rider job links and alerts to sellers.
        </li>
        <li>
          <strong>AI providers (Groq, and Anthropic when enabled):</strong> to read order messages and pictures.
        </li>
        <li>
          <strong>Convex and Vercel:</strong> to host Stallo’s database and website.
        </li>
      </ul>
      <p>
        Some of these services store or process data outside Ghana. We also share information when the law requires it, or to protect people
        from fraud or harm. Within an order, the seller sees their customers’ details, and the rider sees what they need to deliver while the
        delivery is open.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep a seller’s information, and the orders and customer details that belong to their business, for as long as their account is
        open, and afterwards only as long as needed for payment records, disputes and legal obligations. Delivery codes are stored only in a
        scrambled form that cannot be read back.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask to see the information we hold about you, to correct it, or to delete it. Customers can also ask the seller they ordered
        from. Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from, or mentioning, the phone number concerned, and we will reply
        within 30 days. We follow Ghana’s Data Protection Act, 2012 (Act 843).
      </p>

      <h2>Security</h2>
      <p>
        Data is sent over encrypted connections. Passwords and delivery codes are stored as hashes, and access to the systems is limited. No
        system is perfectly secure; if something goes wrong that affects you, we will tell you.
      </p>

      <h2>Cookies and storage</h2>
      <p>
        The website stores only what is needed to keep you signed in. We do not use advertising or tracking cookies.
      </p>

      <h2>Children</h2>
      <p>Stallo is for businesses. Sellers must be at least 18.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we will update the date at the top, and tell sellers in the dashboard when the change matters. See also our{' '}
        <Link to="/terms">terms</Link>.
      </p>
    </LegalPage>
  )
}
