/**
 * getSwapQuote — spec 001-lifi-swap, spec 003-cross-chain-swap
 *
 * Satisfies (001):
 *  - SDK-5   a quote carries input amount, guaranteed minimum output, the output token's
 *            address and decimals, the resolved route, the spender and a 30 s expiry
 *  - SDK-6   no route for the pair and amount fails with NO_ROUTE
 *  - SDK-8   a chain outside the supported set fails with UNSUPPORTED_CHAIN — widened by
 *            CC-3 to check both the origin and the destination chain
 *  - SDK-10  either token cannot be swapped on its own chain fails with UNSUPPORTED_TOKEN —
 *            corrected by CC-4: each token is validated against its own chain's token set,
 *            not both against the origin's
 *  - SDK-36  an omitted slippage tolerance defaults to 0.5%
 *  - SDK-37  a slippage tolerance outside (0, 15] fails with INVALID_SLIPPAGE, before any
 *            network call
 *  - SDK-38  slippage is a percentage at this boundary; the wire conversion lives in lifiClient
 *
 * Satisfies (003):
 *  - CC-1   a request whose origin and destination chains differ is accepted and resolved,
 *           not rejected — SDK-9's guard is removed, not replaced
 *  - CC-2   a same-chain request is validated exactly as 001 specifies: the recipient guard
 *           below only fires when the chains differ, so nothing here changes for it
 *  - CC-3   either chain outside the supported set fails with UNSUPPORTED_CHAIN
 *  - CC-4   the input token is validated against the origin chain's token set and the output
 *           token against the destination chain's, via 002's fetchTokensForChains
 *  - CC-6   a cross-chain request naming a recipient other than the sender fails with
 *           UNSUPPORTED_RECIPIENT, before any network call
 *  - CC-8   the 30 s expiry is stamped identically whether or not the chains differ
 *  - CC-28  CROSS_CHAIN_NOT_SUPPORTED is never raised — its only raise site is removed
 *  - CC-29  UNSUPPORTED_RECIPIENT is raised here, and only here
 *
 * Validation order is deliberate (D-5): cheap local checks first, network calls last, so
 * nothing is spent to learn a locally-detectable input was malformed.
 */

/** local imports */
import { SwapError } from './SwapError'
import { fetchQuote, fetchTokensForChains } from './internal/lifiClient'
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

  const isCrossChain = fromChainId !== toChainId

  if (isCrossChain && toAddress !== undefined) {
    const normalizedFromAddress = normalizeEvmAddress(fromAddress)
    const normalizedToAddress = normalizeEvmAddress(toAddress)

    if (normalizedToAddress !== normalizedFromAddress)
      throw new SwapError(
        'UNSUPPORTED_RECIPIENT',
        'A cross-chain swap can only deliver to the address supplying the input',
        { fromAddress, toAddress },
      )
  }

  if (!isSwapSupportedChain(fromChainId))
    throw new SwapError('UNSUPPORTED_CHAIN', `Chain ${fromChainId} is not supported for swaps`, {
      chainId: fromChainId,
    })

  if (!isSwapSupportedChain(toChainId))
    throw new SwapError('UNSUPPORTED_CHAIN', `Chain ${toChainId} is not supported for swaps`, {
      chainId: toChainId,
    })

  const normalizedFromToken = normalizeEvmAddress(fromTokenAddress)
  const normalizedToToken = normalizeEvmAddress(toTokenAddress)

  const tokensByChain = await fetchTokensForChains([fromChainId, toChainId])
  const fromToken = tokensByChain[fromChainId].find(
    (t) => normalizeEvmAddress(t.address) === normalizedFromToken,
  )
  const toToken = tokensByChain[toChainId].find(
    (t) => normalizeEvmAddress(t.address) === normalizedToToken,
  )

  if (!fromToken || !toToken)
    throw new SwapError(
      'UNSUPPORTED_TOKEN',
      'One or both tokens are not swappable on their own chain',
      { fromTokenAddress, fromChainId, toTokenAddress, toChainId },
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
