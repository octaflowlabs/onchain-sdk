/** npm imports */
import { JsonRpcApiProvider, JsonRpcProvider, TransactionReceipt, TransactionRequest } from 'ethers'

// & Estimate Gas Limit from Provider interfaces
export interface EstimateGasLimitFromProviderProps {
  provider: JsonRpcApiProvider | JsonRpcProvider
  unsignedTx: TransactionRequest
  walletAddress: string
  defaultGasLimit: bigint //TODO: use defaultGasLimit per transaction type when this scales
}

export interface GasEstimateResult {
  gasEstimated: bigint
  gasLimit: bigint
  bufferPercentage: number
  fallbackUsed: boolean
  feeData: {
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
    gasPrice?: bigint
  }
  //   suggestedGasFees?: GasFeesApiResponse
}

// & Build Unsigned Transfer Tx interfaces
export interface BuildUnsignedTransferTxOptions {
  fromAddress: string
  toAddress: string
  value?: string
  data?: string
  tokenAddress?: string
  tokenDecimals?: number
  rpcUrl: string
  chainId?: number
  defaultGasLimit: bigint //TODO: use defaultGasLimit per transaction type when this scales
}

export interface UnsignedTransferTxResponse {
  unsignedTx: TransactionRequest
  nonce: number
  gasEstimated: string
  gasLimit: string
  gasReserve?: string
  bufferPercentage: number
  feeData: {
    maxFeePerGas?: string
    maxPriorityFeePerGas?: string
    gasPrice?: string
  }
  //   suggestedGasFees?: any
  //   humanReadableFees?: {
  //     low?: { maxFeePerGasGwei: string; maxPriorityFeePerGasGwei: string }
  //     medium?: { maxFeePerGasGwei: string; maxPriorityFeePerGasGwei: string }
  //     high?: { maxFeePerGasGwei: string; maxPriorityFeePerGasGwei: string }
  //   }
}

export interface BuildMaxNativeTransferTxOptions extends Omit<
  BuildUnsignedTransferTxOptions,
  'value' | 'tokenAddress' | 'tokenDecimals'
> {
  balance: string
  tokenAddress?: string
}

export interface BuildMaxNativeTransferTxResponse extends UnsignedTransferTxResponse {
  sendableValue: string
}

// & Broadcast Transaction interfaces
export interface BroadcastTransactionOptions {
  signedTx: string
  rpcUrl: string
  chainId?: number
  waitConfirmations?: number
}

// & Tx Status interfaces
export interface TxStatusOptions {
  rpcUrl: string
  txHash: string
  chainId?: number
}

export interface TxStatusResponse {
  success: boolean
  receipt: TransactionReceipt | null
}

// & Format Amount for Display interfaces
export interface FormatAmountOptions {
  decimalsToShow?: number
  useGroupSeparator?: boolean
  locale?: string
  minimumFractionDigits?: number
  minDisplayDecimals?: number
  maxDisplayDigits?: number
}

// & Transaction Request
export type { TransactionRequest }

// & Get Balance interfaces
export interface GetBalanceParams {
  walletAddress: string
  rpcUrl: string
  tokenAddress?: string
  chainId?: number
}

export interface GetBalancesChainRequest {
  rpcUrl: string
  chainId?: number
  tokenAddresses: string[]
  includeNative?: boolean
}

export interface GetBalancesParams {
  walletAddress: string
  chains: GetBalancesChainRequest[]
}

export interface TokenBalance {
  tokenAddress: string | null
  balance: bigint | null
  error?: unknown
}

export interface ChainBalances {
  chainId?: number
  balances: TokenBalance[]
}

export interface GetBalanceResult {
  walletAddress: string
  chains: ChainBalances[]
}

export interface ChainGroup {
  rpcUrl: string
  chainId?: number
  nativeBalanceRequests: GetBalanceParams[]
  tokenBalanceRequests: GetBalanceParams[]
}
