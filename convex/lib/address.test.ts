import { describe, expect, it } from 'vitest'
import { findDigitalAddress, mapsUrl } from './address'

describe('findDigitalAddress', () => {
  it('finds Ghana Post digital addresses written in common ways', () => {
    expect(findDigitalAddress('House near the church, GA-183-8164')).toBe('GA-183-8164')
    expect(findDigitalAddress('ak 039 5028 Kumasi')).toBe('AK-039-5028')
    expect(findDigitalAddress('GE-2314-3830')).toBe('GE-2314-3830')
  })

  it('ignores text without one', () => {
    expect(findDigitalAddress('Madina, near the zongo junction')).toBeNull()
    expect(findDigitalAddress('Call 024 123 4567')).toBeNull()
    expect(findDigitalAddress('GA1838164')).toBeNull()
  })
})

describe('mapsUrl', () => {
  it('prefers the shared pin, then the digital address, then the address', () => {
    expect(mapsUrl({ location: { lat: 5.6, lng: -0.2 }, address: 'Madina' })).toBe('https://maps.google.com/?q=5.6,-0.2')
    expect(mapsUrl({ digitalAddress: 'GA-183-8164', address: 'Adenta' })).toContain('query=GA-183-8164')
    expect(mapsUrl({ address: 'Madina' })).toContain('query=Madina')
    expect(mapsUrl({})).toBeUndefined()
  })
})
