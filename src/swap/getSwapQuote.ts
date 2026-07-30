/**
 * getSwapQuote — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-5   a quote carries input amount, guaranteed minimum output, the output token's
 *            address and decimals, the resolved route, the spender and a 30 s expiry
 *  - SDK-6   no route for the pair and amount fails with NO_ROUTE
 *  - SDK-8   a chain outside the supported set fails with UNSUPPORTED_CHAIN
 *  - SDK-9   a cross-chain request fails with CROSS_CHAIN_NOT_SUPPORTED, before any network call
 *  - SDK-10  either token absent from the chain's token list fails with UNSUPPORTED_TOKEN
 *  - SDK-36  an omitted slippage tolerance defaults to 0.5%
 *  - SDK-37  a slippage tolerance outside (0, 15] fails with INVALID_SLIPPAGE, before any
 *            network call
 *  - SDK-38  slippage is a percentage at this boundary; the wire conversion lives in lifiClient
 *
 * Validation order is deliberate (D-5): cheap local checks first, network calls last, so
 * nothing is spent to learn a locally-detectable input was malformed.
 */

/** local imports */
import { SwapError } from './SwapError'
import { fetchQuote, fetchTokens } from './internal/lifiClient'
import { isSwapSupportedChain } from '../constants/SWAP_SUPPORTED_CHAINS'
import { parsedAmount } from '../utils/formatAmount'
import { normalizeEvmAddress } from '../utils/normalizeAddress'
import { GetSwapQuoteParams, SwapQuote } from '../types/swap'

const DEFAULT_SLIPPAGE_PERCENT = 0.5
const MAX_SLIPPAGE_PERCENT = 15
const QUOTE_TTL_MS = 30_000

const resolveSlippagePercent = (slippagePercent: number | undefined): number => {
  if (slippagePercent === undefined) return DEFAULT_SLIPPAGE_PERCENT

  if (slippagePercent <= 0 || slippagePercent > MAX_SLIPPAGE_PERCENT)
    throw new SwapError(
      'INVALID_SLIPPAGE',
      `Slippage tolerance must be greater than 0 and at most ${MAX_SLIPPAGE_PERCENT}%`,
      slippagePercent,
    )

  return slippagePercent
}

export const getSwapQuote = async ({
  fromChainId,
  toChainId,
  fromTokenAddress,
  toTokenAddress,
  fromAmount,
  fromAddress,
  toAddress,
  slippagePercent,
}: GetSwapQuoteParams): Promise<SwapQuote> => {
  const resolvedSlippagePercent = resolveSlippagePercent(slippagePercent)

  if (fromChainId !== toChainId)
    throw new SwapError(
      'CROSS_CHAIN_NOT_SUPPORTED',
      'Cross-chain swaps are not supported; fromChainId and toChainId must match',
      { fromChainId, toChainId },
    )

  if (!isSwapSupportedChain(fromChainId))
    throw new SwapError('UNSUPPORTED_CHAIN', `Chain ${fromChainId} is not supported for swaps`, {
      chainId: fromChainId,
    })

  const normalizedFromToken = normalizeEvmAddress(fromTokenAddress)
  const normalizedToToken = normalizeEvmAddress(toTokenAddress)

  const chainTokens = await fetchTokens(fromChainId)
  const fromToken = chainTokens.find((t) => normalizeEvmAddress(t.address) === normalizedFromToken)
  const toToken = chainTokens.find((t) => normalizeEvmAddress(t.address) === normalizedToToken)

  if (!fromToken || !toToken)
    throw new SwapError(
      'UNSUPPORTED_TOKEN',
      'One or both tokens are not swappable on the requested chain',
      { fromTokenAddress, toTokenAddress, chainId: fromChainId },
    )

  const quote = await fetchQuote({
    fromChainId,
    toChainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount: parsedAmount(fromAmount, fromToken.decimals),
    fromAddress,
    toAddress,
    slippagePercent: resolvedSlippagePercent,
  })

  return { ...quote, expiresAt: Date.now() + QUOTE_TTL_MS }
}
