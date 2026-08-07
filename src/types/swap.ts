/**
 * Swap types — spec 001-lifi-swap, spec 002-token-registry, spec 003-cross-chain-swap
 *
 * Satisfies (001):
 *  - SDK-1  every token amount is an integer in the token's smallest unit, never a float
 *  - SDK-2  amounts enter as decimal strings and are converted using that token's decimals
 *  - SDK-5  a quote carries input amount, guaranteed minimum output, the output token's
 *           address and decimals, the resolved route, the spender and an absolute expiry
 *  - FC-6   strings in, bigint out — the consumer never receives a float
 *  - FC-8   the swap state is exactly one of five values
 *
 * Satisfies (002):
 *  - TR-1   published tokens are expressed in a type this SDK owns, never the routing
 *           service's own token type
 *  - TR-4   every published token carries chain, address, decimals, symbol, name, isNative
 *           and an optional logo location
 *  - TR-7   no published token carries a balance, an amount or a price
 *  - TFC-9  the consumer joins published tokens with the SDK's existing balance reading;
 *           nothing here duplicates it
 *
 * Satisfies (003):
 *  - CC-28   CROSS_CHAIN_NOT_SUPPORTED is removed from the closed set of error codes
 *  - CC-29   UNSUPPORTED_RECIPIENT is added to the closed set
 *  - CC-30   a settlement reason is a value carried by SwapSettlementReport, drawn from its
 *            own closed set, never expressed as a raised SwapErrorCode
 *  - CFC-15  CROSS_CHAIN_NOT_SUPPORTED no longer exists; UNSUPPORTED_RECIPIENT takes its place
 *  - CFC-16  two closed sets that never cross: SwapErrorCode is raised, SwapSettlementReason
 *            is carried on a settlement report
 */

// & Swap lifecycle
export type SwapState = 'approving' | 'approved' | 'swapping' | 'done' | 'error'

export type SwapPhase = 'approval' | 'swap'

export type SwapTxOutcome = 'not-submitted' | 'pending' | 'success' | 'failed'

// & Errors
export type SwapErrorCode =
  | 'NO_ROUTE'
  | 'UNSUPPORTED_CHAIN'
  | 'UNSUPPORTED_TOKEN'
  | 'UNSUPPORTED_RECIPIENT'
  | 'QUOTE_EXPIRED'
  | 'INSUFFICIENT_ALLOWANCE'
  | 'INVALID_SLIPPAGE'
  | 'EXECUTION_REVERTED'
  | 'PROVIDER_ERROR'

// & Quote
export interface SwapTokenInfo {
  address: string
  decimals: number
  symbol: string
}

export interface SwapRouteSummary {
  tool: string
  toolName: string
  steps: number
}

export interface LifiTransactionRequest {
  to: string
  data: string
  value: bigint
  chainId?: number
  from?: string
  gasLimit?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

export interface SwapQuote {
  fromChainId: number
  toChainId: number
  fromToken: SwapTokenInfo
  toToken: SwapTokenInfo
  fromAmount: bigint
  toAmount: bigint
  toAmountMin: bigint
  slippagePercent: number
  spender: string
  expiresAt: number
  route: SwapRouteSummary
  raw: LifiTransactionRequest
}

// & Settlement
export type SwapSettlementOutcome = Exclude<SwapTxOutcome, 'not-submitted'>

export type SwapSettlementReason = 'refunded' | 'execution-failed' | 'not-recognized'

export interface SwapSettlementReport {
  outcome: SwapSettlementOutcome
  reason?: SwapSettlementReason
  receivedAmount?: bigint
  receivedToken?: SwapTokenInfo
  destinationTxHash?: string
}

// & Token registry
export interface SwapToken extends SwapTokenInfo {
  chainId: number
  name: string
  isNative: boolean
  logoURI?: string
}

// & Operation parameters
export interface GetSwapQuoteParams {
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromAmount: string
  fromAddress: string
  toAddress?: string
  slippagePercent?: number
}

export interface BuildSwapApprovalTxsParams {
  quote: SwapQuote
  walletAddress: string
  rpcUrl: string
}

export interface BuildSwapTxParams {
  quote: SwapQuote
  walletAddress: string
  rpcUrl: string
}

export interface ResolveSwapStateParams {
  phase: SwapPhase
  outcome: SwapTxOutcome
}

export interface GetAllSwapTokensParams {
  chainIds: number[]
}

export interface GetSwapSettlementParams {
  txHash: string
  fromChainId: number
  toChainId: number
}
