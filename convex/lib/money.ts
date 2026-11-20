/** Money is stored as integer pesewas (100 pesewas = GH₵ 1). Format only at the edge. Shared by Convex and the web app. */

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

/** { percent: 2.5, flatPesewas: 50 } → "2.5% + GH₵ 0.50". Null when there is no fee. */
export function formatFee({ percent, flatPesewas }: { percent: number; flatPesewas: number }): string | null {
  const parts: string[] = []
  if (percent > 0) parts.push(`${Number(percent.toFixed(2))}%`)
  if (flatPesewas > 0) parts.push(formatCedis(flatPesewas))
  return parts.length > 0 ? parts.join(' + ') : null
}
