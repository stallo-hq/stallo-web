/** Money is stored as integer pesewas (100 pesewas = GH₵ 1). Format only at the edge. */

const formatter = new Intl.NumberFormat('en-GH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 125050 → "GH₵ 1,250.50" */
export function formatCedis(pesewas: number): string {
  return `GH₵ ${formatter.format(pesewas / 100)}`
}

/** "1,250.5" → 125050. Returns null for anything that isn't a positive amount with ≤ 2 decimals. */
export function parseCedis(input: string): number | null {
  const cleaned = input.replace(/GH₵|GHS|,|\s/gi, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.split('.')
  const pesewas = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(pesewas) && pesewas > 0 ? pesewas : null
}

/** 125050 → "1250.50" for prefilling an input. */
export function pesewasToInput(pesewas: number): string {
  return (pesewas / 100).toFixed(2)
}
