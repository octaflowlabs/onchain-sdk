/**
 * Swap types — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-1  every token amount is an integer in the token's smallest unit, never a float
 *  - SDK-2  amounts enter as decimal strings and are converted using that token's decimals
 *  - SDK-5  a quote carries input amount, guaranteed minimum output, the output token's
 *           address and decimals, the resolved route, the spender and an absolute expiry
 *  - FC-6   strings in, bigint out — the consumer never receives a float
 *  - FC-8   the swap state is exactly one of five values
 */

// & Swap lifecycle
export type SwapState = 'approving' | 'approved' | 'swapping' | 'done' | 'error'

export type SwapPhase = 'approval' | 'swap'

export type SwapTxOutcome = 'not-submitted' | 'pending' | 'success' | 'failed'

// & Errors
export type SwapErrorCode =
  | 'NO_ROUTE'
  | 'UNSUPPORTED_CHAIN'
  | 'CROSS_CHAIN_NOT_SUPPORTED'
  | 'UNSUPPORTED_TOKEN'
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
