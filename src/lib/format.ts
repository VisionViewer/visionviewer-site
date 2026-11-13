const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** 9.9 → « 9,90 € » */
export function formatEuro(amount: number): string {
  return euro.format(amount)
}

/** 10.63 → « 10,6 » */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
