const nf0 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

export const int = (n: number) => nf0.format(n)
export const num = (n: number) => nf2.format(n)
export const money = (n: number) => '$' + nf2.format(n)
export function moneyShort(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${nf2.format(n / 1e9)} mil M`
  if (a >= 1e6) return `$${nf2.format(n / 1e6)} M`
  if (a >= 1e3) return `$${nf2.format(n / 1e3)} k`
  return `$${nf2.format(n)}`
}
export function pct(p: number | null | undefined, digits = 1): string {
  if (p == null) return 'n/d'
  return (p * 100).toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%'
}
export const dateOnly = (label: string) => label.slice(0, 10)
