/**
 * Prints a fresh JWT_PRIVATE_KEY and JWKS for a Convex deployment's sign-in.
 * Each deployment (dev, production) needs its own pair.
 *
 *   node scripts/auth-keys.mjs > auth-keys.txt
 *
 * Paste both values into the Convex dashboard (Settings, Environment Variables),
 * then delete auth-keys.txt. Never commit it.
 */
import { generateKeyPairSync } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trimEnd().replace(/\n/g, ' ')
const jwks = JSON.stringify({ keys: [{ use: 'sig', alg: 'RS256', ...publicKey.export({ format: 'jwk' }) }] })

process.stdout.write(`JWT_PRIVATE_KEY\n${pem}\n\nJWKS\n${jwks}\n`)
