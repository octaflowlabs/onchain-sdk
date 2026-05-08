import { formattedAmountForDisplay, parsedAmount } from '..'

const DECIMAL_PATTERN = /^\d*(\.\d*)?$/
const UINT_PATTERN = /^\d+$/

export function toGwei(wei: bigint): string {
  return formattedAmountForDisplay(wei, 9, {
    useGroupSeparator: false as const,
    decimalsToShow: 9,
  })
}

export function tryParseGweiToWei(input: string): bigint | null {
  const valueNormalized = input.trim().replace(/,/g, '.')
  if (!valueNormalized || valueNormalized === '.') return null
  if (!DECIMAL_PATTERN.test(valueNormalized)) return null

  try {
    return parsedAmount(valueNormalized, 9)
  } catch {
    return null
  }
}

export function parseGasLimit(input: string): bigint | null {
  const trimmed = input.trim().replace(/\s/g, '')
  if (!UINT_PATTERN.test(trimmed)) return null

  const value = BigInt(trimmed)
  // 21000 is the minimum - protcol-enforced floor for any tx
  if (value < 21000n) return null

  return value
}
