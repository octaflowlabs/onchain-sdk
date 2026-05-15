/** local imports */
import { GAS_LIMIT_PER_TX_TYPE } from '../constants/constants'
import { FeeDataInput } from '../types/common'
import { getProvider } from './getProvider'

export type FeeSnapshotTxKind = keyof typeof GAS_LIMIT_PER_TX_TYPE

export type FetchFeeSnapshotOptions = {
  rpcUrl: string
  chainId: number
  /**
   * Selects a default `gasLimit` for the returned `FeeDataInput` (e.g. for `getFeePresets`).
   * Does not trigger `eth_estimateGas`; only `gasLimit` on the returned object changes.
   */
  txKind?: FeeSnapshotTxKind
  /** When set, overrides the gas limit implied by `txKind`. */
  gasLimit?: bigint
}

/**
 * Reads current fee fields from the node (`getFeeData` → `eth_feeHistory` / `eth_gasPrice`, etc.).
 * Does not call `eth_estimateGas` or `eth_getTransactionCount`.
 */
export const fetchFeeSnapshot = async (options: FetchFeeSnapshotOptions): Promise<FeeDataInput> => {
  const {
    rpcUrl,
    chainId,
    txKind = 'DEFAULT_TRANSFER_NATIVE',
    gasLimit: gasLimitOverride,
  } = options

  const provider = getProvider(rpcUrl, chainId)
  if (!provider) throw new Error('Could not create provider with given rpcUrl and chainId')

  const raw = await provider.getFeeData()
  const feeData = {
    maxFeePerGas: raw.maxFeePerGas ?? undefined,
    maxPriorityFeePerGas: raw.maxPriorityFeePerGas ?? undefined,
    gasPrice: raw.gasPrice ?? undefined,
  }

  const has1559 = feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null
  const hasLegacy = feeData.gasPrice != null
  if (!has1559 && !hasLegacy) {
    throw new Error(
      'fetchFeeSnapshot: provider returned no usable fee fields (EIP-1559 or legacy gas price)',
    )
  }

  const gasLimit = gasLimitOverride ?? GAS_LIMIT_PER_TX_TYPE[txKind]

  return {
    chainId,
    gasLimit,
    feeData,
  }
}
