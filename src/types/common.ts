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

export interface EstimateTransactionOptions {
  rpcUrl: string
  chainId: number
  tx: TransactionRequest
  fromAddress: string
  defaultGasLimit?: bigint
}

export interface PrepareTransactionParams extends EstimateTransactionOptions {}

export interface EstimateTransactionResult {
  gasLimit: bigint
  gasEstimated: bigint
  feeData: {
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
    gasPrice?: bigint
  }
  gasReserve?: bigint
  humanReadableGasReserve: string
  bufferPercentage: number
}

export interface PrepareTransactionResult {
  unsignedTx: TransactionRequest
  nonce: number
  gasEstimated: bigint
  gasLimit: bigint
  gasReserve?: bigint
  bufferPercentage: number
  feeData: {
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
    gasPrice?: bigint
  }
  humanReadableGasReserve: string
}

// & Build Unsigned Transfer Tx interfaces
export interface BuildBaseUnsignedTransferTxParams {
  recipientAddress: string
  value: string
  tokenAddress?: string
  tokenDecimals?: number
}

export interface BuildUnsignedTransferTxOptions {
  fromAddress: string
  toAddress: string
  value?: string
  tokenAddress?: string
  tokenDecimals?: number
  rpcUrl: string
  chainId?: number
  defaultGasLimit: bigint //TODO: use defaultGasLimit per transaction type when this scales
}

export interface BuildMaxNativeTransferTxOptions extends Omit<
  BuildUnsignedTransferTxOptions,
  'value' | 'tokenDecimals'
> {
  balance: string
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
  status: 'pending' | 'success' | 'failed' // Satisfies SDK-24
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

export type EIP1559Fees = {
  mode: 'eip1559'
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  gasLimit: bigint
}

export type LegacyFees = {
  mode: 'legacy'
  gasPrice: bigint
  gasLimit: bigint
}

export type ResolvedFees = EIP1559Fees | LegacyFees

export type FeeModel = 'eip1559' | 'legacy'

export type FeePresetLabel = 'Low' | 'Standard' | 'High'

export type FeeEstimateSeconds = {
  min: number
  max: number
}

export type FeePreset = {
  label: FeePresetLabel
  fees: ResolvedFees
  humanReadableGasReserve: string
  humanReadableEstimatedCost: string
  estimatedSeconds?: FeeEstimateSeconds
}

export type FeeHistoryData = {
  currentBaseFee: string // in GWEI, to show in UI
  range12h: {
    minBaseFee: string
    maxBaseFee: string
    minPriorityFee: string
    maxPriorityFee: string
  }
}

export type FeeDataInput = {
  chainId?: number
  gasLimit?: bigint | string | number
  feeData?: {
    maxFeePerGas?: bigint | string
    maxPriorityFeePerGas?: bigint | string
    gasPrice?: bigint | string
  }
}
