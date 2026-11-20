import { LANGUE } from './langue'

// Dans la langue de la page : « 9,90 € » en français, « €9.90 » en anglais
const euro = new Intl.NumberFormat(LANGUE || 'en', { style: 'currency', currency: 'EUR' })

/** 9.9 → « 9,90 € » */
export function formatEuro(amount: number): string {
  return euro.format(amount)
}

/** 10.63 → « 10,6 » */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(LANGUE || 'en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
