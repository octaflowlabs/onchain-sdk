/** npm imports */
import { formatUnits, BigNumberish, parseUnits } from 'ethers'

/** local imports */
import { FormatAmountOptions } from '../types/common'

export const formattedAmountForDisplay = (
  amount: BigNumberish,
  decimals: number,
  options: FormatAmountOptions = {},
): string => {
  const {
    decimalsToShow = 0,
    useGroupSeparator = true,
    locale = 'en-US',
    minimumFractionDigits,
    minDisplayDecimals = 9,
    maxDisplayDigits = 16,
  } = options

  const formattedAmount = formatUnits(amount, decimals)
  if (formattedAmount.startsWith('-')) throw new Error('Negative balances are not supported')

  const [wholePart = '0', fractionPart = ''] = formattedAmount.split('.')

  if (wholePart.length >= maxDisplayDigits) {
    const mantissaWhole = wholePart[0] ?? '0'
    const mantissaFraction = (wholePart.slice(1) + fractionPart).slice(0, decimalsToShow)
    const exponent = wholePart.length - 1
    const rawMantissa = mantissaFraction ? `${mantissaWhole}.${mantissaFraction}` : mantissaWhole
    const trimmedMantissa = rawMantissa.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '')
    return `${trimmedMantissa}e${exponent}`
  }

  const firstNonZeroIndex = fractionPart.split('').findIndex((digit) => digit !== '0')
  const hasNonZeroFraction = firstNonZeroIndex !== -1
  if (hasNonZeroFraction && wholePart === '0' && firstNonZeroIndex >= minDisplayDecimals) {
    const sample = new Intl.NumberFormat(locale).format(1000.1)
    const decimalSeparator = sample.replace(/\d/g, '').slice(-1) ?? '.'
    const minValue = `0${decimalSeparator}${'0'.repeat(Math.max(0, minDisplayDecimals - 1))}1`
    return `< ${minValue}`
  }
  if (!hasNonZeroFraction) {
    const sample = new Intl.NumberFormat(locale).format(1000.1)
    const groupSeparator = sample.replace(/\d/g, '')[0] ?? ','
    const groupedWhole = useGroupSeparator
      ? (wholePart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator)
      : wholePart
    return groupedWhole
  }

  const maxDecimals = decimalsToShow ?? fractionPart.length
  let trimmedFraction = fractionPart.slice(0, Math.max(0, maxDecimals))
  const minDecimals = minimumFractionDigits ?? 0
  if (trimmedFraction.length < minDecimals) {
    trimmedFraction = trimmedFraction.padEnd(minDecimals, '0')
  }

  const sample = new Intl.NumberFormat(locale).format(1000.1)
  const groupSeparator = sample.replace(/\d/g, '')[0] ?? ','
  const decimalSeparator = sample.replace(/\d/g, '').slice(-1) ?? '.'

  const groupedWhole = useGroupSeparator
    ? (wholePart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator)
    : wholePart

  if (!trimmedFraction) return groupedWhole

  return `${groupedWhole}${decimalSeparator}${trimmedFraction}`
}

export const parsedAmount = (amount: string, decimals: number): bigint =>
  parseUnits(amount, decimals)
