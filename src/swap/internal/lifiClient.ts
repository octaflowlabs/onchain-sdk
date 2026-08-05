/**
 * LI.FI adapter — spec 001-lifi-swap, spec 002-token-registry
 *
 * Satisfies (001):
 *  - SDK-4   spender is the address the quote designates for the allowance, never the tx target
 *  - SDK-5   a quote carries amounts, output token metadata, route, spender
 *  - SDK-6   no route for the pair and amount fails with NO_ROUTE
 *  - SDK-33  unreachable or malformed routing-service responses fail with PROVIDER_ERROR
 *  - SDK-38  slippage is a percentage here and a fraction on the wire
 *
 * Satisfies (002):
 *  - TR-1   the routing service's own Token type never crosses into a published type
 *  - TR-6   isNative is computed from the zero address, never a symbol
 *  - TR-11  fetchTokensForChains returns every token the routing service lists per chain
 *  - TR-12  the one getTokens call site takes `chains` and nothing else — no price,
 *           verification or popularity filter
 *  - TR-16  a chain already cached is served from memory with no further request
 *  - TR-19  a logoURI pointing at the dead Zapper bucket is dropped, never published
 *
 * The only module importing `@lifi/sdk` (D-1, D-11). Nothing execution-related is imported:
 * `executeRoute` and every signing path stay unreachable (SDK-3).
 *
 * Verified against @lifi/sdk 3.1.5 on 2026-07-30:
 *  - `getQuote` works with no `createConfig` call: the package ships a default
 *    `integrator: 'lifi-sdk'`, so the guard inside `request()` does not fire. A per-request
 *    `integrator` is still sent for attribution.
 *  - Failures arrive as `SDKError` wrapping an `HTTPError` on `.cause`, which carries the
 *    numeric `.status` and a `.responseBody` of `{ message, code }`.
 *  - HTTP 404 is the no-route signal: `"No available quotes for the requested transfer"`.
 *  - `transactionRequest.value` and `.gasLimit` arrive as hex strings, estimate amounts as
 *    decimal strings. `BigInt()` parses both.
 *
 * Verified against `GET https://li.quest/v1/tokens` on 2026-08-05 (OQ-4 of spec 002):
 * `storage.googleapis.com/zapper-fi-assets/...` answers every request with HTTP 403
 * `UserProjectAccountProblem` — the bucket's billing account is disabled and this will not
 * recover. It accounted for 44% of Base's logo locations and 74% of Ethereum's.
 */

/** npm imports */
import { getQuote, getTokens, type QuoteRequest, type Token } from '@lifi/sdk'

/** local imports */
import { SwapError } from '../SwapError'
import { isNativeTokenAddress } from './nativeToken'
import { LifiTransactionRequest, SwapQuote, SwapToken, SwapTokenInfo } from '../../types/swap'

const INTEGRATOR = 'octaflow'
const NOT_FOUND_STATUS = 404

interface FetchQuoteParams {
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromAmount: bigint
  fromAddress: string
  toAddress?: string
  slippagePercent: number
}

export type FetchedQuote = Omit<SwapQuote, 'expiresAt'>

const httpStatusOf = (error: unknown): number | undefined => {
  const cause = (error as { cause?: { status?: unknown } })?.cause
  return typeof cause?.status === 'number' ? cause.status : undefined
}

const upstreamMessageOf = (error: unknown): string | undefined => {
  const body = (error as { cause?: { responseBody?: { message?: unknown } } })?.cause?.responseBody
  return typeof body?.message === 'string' ? body.message : undefined
}

const toBigInt = (value: unknown): bigint | undefined => {
  if (typeof value === 'bigint') return value
  if (typeof value !== 'string' && typeof value !== 'number') return undefined

  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

const requireBigInt = (value: unknown, field: string): bigint => {
  const parsed = toBigInt(value)
  if (parsed === undefined)
    throw new SwapError('PROVIDER_ERROR', `Routing service returned a malformed ${field}`, value)

  return parsed
}

const toTokenInfo = (token: Token): SwapTokenInfo => ({
  address: token.address,
  decimals: token.decimals,
  symbol: token.symbol,
})

export const fetchQuote = async ({
  fromChainId,
  toChainId,
  fromTokenAddress,
  toTokenAddress,
  fromAmount,
  fromAddress,
  toAddress,
  slippagePercent,
}: FetchQuoteParams): Promise<FetchedQuote> => {
  const request: QuoteRequest = {
    fromChain: fromChainId,
    toChain: toChainId,
    fromToken: fromTokenAddress,
    toToken: toTokenAddress,
    fromAddress,
    toAddress: toAddress ?? fromAddress,
    fromAmount: fromAmount.toString(),
    slippage: slippagePercent / 100,
    integrator: INTEGRATOR,
  }

  let step
  try {
    step = await getQuote(request)
  } catch (error) {
    if (httpStatusOf(error) === NOT_FOUND_STATUS)
      throw new SwapError(
        'NO_ROUTE',
        upstreamMessageOf(error) ?? 'No route available for the requested swap',
        error,
      )

    throw new SwapError(
      'PROVIDER_ERROR',
      upstreamMessageOf(error) ?? 'Routing service request failed',
      error,
    )
  }

  const { transactionRequest, estimate, action } = step

  if (!transactionRequest)
    throw new SwapError('NO_ROUTE', 'Routing service returned no executable transaction', step)

  if (!transactionRequest.to || !transactionRequest.data)
    throw new SwapError(
      'PROVIDER_ERROR',
      'Routing service returned a transaction without a destination or calldata',
      transactionRequest,
    )

  if (!estimate?.approvalAddress)
    throw new SwapError('PROVIDER_ERROR', 'Routing service returned no approval address', estimate)

  const raw: LifiTransactionRequest = {
    to: transactionRequest.to,
    data: transactionRequest.data,
    value: toBigInt(transactionRequest.value) ?? 0n,
    chainId: transactionRequest.chainId,
    from: transactionRequest.from,
    gasLimit: toBigInt(transactionRequest.gasLimit),
    gasPrice: toBigInt(transactionRequest.gasPrice),
    maxFeePerGas: toBigInt(transactionRequest.maxFeePerGas),
    maxPriorityFeePerGas: toBigInt(transactionRequest.maxPriorityFeePerGas),
  }

  return {
    fromChainId,
    toChainId,
    fromToken: toTokenInfo(action.fromToken),
    toToken: toTokenInfo(action.toToken),
    fromAmount: requireBigInt(estimate.fromAmount, 'fromAmount'),
    toAmount: requireBigInt(estimate.toAmount, 'toAmount'),
    toAmountMin: requireBigInt(estimate.toAmountMin, 'toAmountMin'),
    slippagePercent,
    spender: estimate.approvalAddress,
    route: {
      tool: step.tool,
      toolName: step.toolDetails?.name ?? step.tool,
      steps: step.includedSteps?.length ?? 1,
    },
    raw,
  }
}

const tokensByChain = new Map<number, Token[]>()

export const fetchTokensForChains = async (
  chainIds: number[],
): Promise<Record<number, Token[]>> => {
  const uniqueChainIds = [...new Set(chainIds)]
  const missingChainIds = uniqueChainIds.filter((chainId) => !tokensByChain.has(chainId))

  if (missingChainIds.length > 0) {
    let response
    try {
      response = await getTokens({ chains: missingChainIds })
    } catch (error) {
      throw new SwapError(
        'PROVIDER_ERROR',
        upstreamMessageOf(error) ?? 'Could not read the supported token list',
        error,
      )
    }

    const fetchedTokens = missingChainIds.map((chainId) => {
      const tokens = response?.tokens?.[chainId]
      if (!Array.isArray(tokens))
        throw new SwapError(
          'PROVIDER_ERROR',
          `Routing service returned no token list for chain ${chainId}`,
          response,
        )

      return [chainId, tokens] as const
    })

    for (const [chainId, tokens] of fetchedTokens) tokensByChain.set(chainId, tokens)
  }

  const result: Record<number, Token[]> = {}
  for (const chainId of uniqueChainIds) result[chainId] = tokensByChain.get(chainId) as Token[]
  return result
}

export const fetchTokens = async (chainId: number): Promise<Token[]> =>
  (await fetchTokensForChains([chainId]))[chainId]

const DEAD_LOGO_HOST = 'storage.googleapis.com'
const DEAD_LOGO_PATH_PREFIX = '/zapper-fi-assets/'

const isDeadLogoURI = (logoURI: string): boolean => {
  try {
    const url = new URL(logoURI)
    return url.host === DEAD_LOGO_HOST && url.pathname.startsWith(DEAD_LOGO_PATH_PREFIX)
  } catch {
    return false
  }
}

export const toSwapToken = (token: Token): SwapToken => ({
  ...toTokenInfo(token),
  chainId: token.chainId,
  name: token.name,
  isNative: isNativeTokenAddress(token.address),
  logoURI: token.logoURI && !isDeadLogoURI(token.logoURI) ? token.logoURI : undefined,
})
