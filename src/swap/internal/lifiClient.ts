/**
 * LI.FI adapter — spec 001-lifi-swap, spec 002-token-registry, spec 003-cross-chain-swap
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
 * Satisfies (003):
 *  - CC-11  settlement is read from the routing service and reported as pending/success/failed
 *  - CC-13  in-progress and not-yet-recognised both report pending, indistinguishably
 *  - CC-14  a complete transfer reports success, whatever it actually delivered
 *  - CC-15  a refund reports failed with reason refunded
 *  - CC-16  an upstream-reported failure reports failed with reason execution-failed
 *  - CC-17  a hash the routing service cannot speak about reports failed with reason
 *           not-recognized
 *  - CC-18  a success outcome carries the amount and token actually received, read from
 *           `receiving`, never restated from the quote
 *  - CC-19  the destination transaction hash is omitted, never substituted, when upstream
 *           does not name one
 *  - CC-21  an unreachable service or a response outside the known status shapes fails with
 *           PROVIDER_ERROR
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
 *
 * Verified against `GET https://li.quest/v1/status` on 2026-08-06 (plan D-2, D-3 of spec 003):
 *  - An unknown or not-yet-indexed hash is an **HTTP 404**, thrown by the package exactly like
 *    a no-route quote — the same status code `fetchQuote` maps to `NO_ROUTE` twelve lines below.
 *    That mapping is not reused here: a 404 from `/status` means "not yet indexed", which is
 *    the ordinary answer for the first seconds of every cross-chain swap.
 *  - A malformed hash, and a real transaction hash that is not a routing-service transfer, are
 *    both **HTTP 400** with `{ message, code: 1011 }`.
 *  - A transaction confirmed reverted on-chain first (`eth_getTransactionReceipt` → `status:
 *    0x0`) is reported as `{ status: 'FAILED', sending, receiving: absent }` — HTTP 200, not an
 *    error. `NOT_FOUND` and `INVALID` are declared `StatusMessage` members never observed live;
 *    handled defensively rather than assumed away.
 */

/** npm imports */
import {
  getQuote,
  getStatus,
  getTokens,
  type ExtendedTransactionInfo,
  type GetStatusRequest,
  type PendingReceivingInfo,
  type QuoteRequest,
  type StatusResponse,
  type Token,
} from '@lifi/sdk'

/** local imports */
import { SwapError } from '../SwapError'
import { isNativeTokenAddress } from './nativeToken'
import {
  LifiTransactionRequest,
  SwapQuote,
  SwapSettlementReport,
  SwapToken,
  SwapTokenInfo,
} from '../../types/swap'

const INTEGRATOR = 'octaflow'
const NOT_FOUND_STATUS = 404
const BAD_REQUEST_STATUS = 400

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

interface FetchSettlementParams {
  txHash: string
  fromChainId: number
  toChainId: number
}

/**
 * `PendingReceivingInfo` carries only `chainId`; `ExtendedTransactionInfo` additionally
 * carries `txHash`, so its presence is what discriminates the two (D-7).
 */
const isExtendedTransactionInfo = (
  receiving: PendingReceivingInfo | ExtendedTransactionInfo,
): receiving is ExtendedTransactionInfo => 'txHash' in receiving

/**
 * Reads `receiving` defensively: absent on a failed transfer, `PendingReceivingInfo`-shaped
 * (chainId only) on one still in flight. Every field here stays undefined rather than being
 * back-filled from `sending` or from the quote (CC-19).
 */
const receivedFieldsOf = (
  receiving: PendingReceivingInfo | ExtendedTransactionInfo,
): Pick<SwapSettlementReport, 'receivedAmount' | 'receivedToken' | 'destinationTxHash'> => {
  if (!isExtendedTransactionInfo(receiving)) return {}

  return {
    receivedAmount: toBigInt(receiving.amount),
    receivedToken: receiving.token ? toTokenInfo(receiving.token) : undefined,
    destinationTxHash: receiving.txHash,
  }
}

/**
 * D-2's mapping table, row for row. The switch is exhaustive over `StatusMessage`'s five
 * declared members; `default` exists for a runtime payload that does not match any of them —
 * TypeScript cannot rule that out for a value parsed from an HTTP response.
 */
const toSettlementReport = (response: StatusResponse): SwapSettlementReport => {
  switch (response.status) {
    case 'PENDING':
    case 'NOT_FOUND':
      return { outcome: 'pending' }

    case 'DONE':
      if (response.substatus === 'REFUNDED') return { outcome: 'failed', reason: 'refunded' }
      return { outcome: 'success', ...receivedFieldsOf(response.receiving) }

    case 'FAILED':
      return { outcome: 'failed', reason: 'execution-failed' }

    case 'INVALID':
      return { outcome: 'failed', reason: 'not-recognized' }

    default:
      throw new SwapError(
        'PROVIDER_ERROR',
        'Routing service returned an unrecognised settlement status',
        response,
      )
  }
}

/**
 * The 404 branch here is deliberately independent of `fetchQuote`'s (D-2). The same HTTP
 * status means "no route" on the quote endpoint and "not yet indexed" on this one — sharing
 * the mapping would report every cross-chain swap as failed in the seconds after broadcast.
 */
export const fetchSettlement = async ({
  txHash,
  fromChainId,
  toChainId,
}: FetchSettlementParams): Promise<SwapSettlementReport> => {
  const request: GetStatusRequest = { txHash, fromChain: fromChainId, toChain: toChainId }

  let response: StatusResponse
  try {
    response = await getStatus(request)
  } catch (error) {
    const status = httpStatusOf(error)

    if (status === NOT_FOUND_STATUS) return { outcome: 'pending' }
    if (status === BAD_REQUEST_STATUS) return { outcome: 'failed', reason: 'not-recognized' }

    throw new SwapError(
      'PROVIDER_ERROR',
      upstreamMessageOf(error) ?? 'Could not read settlement from the routing service',
      error,
    )
  }

  return toSettlementReport(response)
}
