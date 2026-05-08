import { NETWORKS_REGISTRY } from '../constants/NETWORKS_REGISTRY'
import {
  FeeDataInput,
  FeeEstimateSeconds,
  FeePreset,
  FeePresetLabel,
  LegacyFees,
} from '../types/common'
import { formattedAmountForDisplay } from './formatAmount'

const DEFAULT_BLOCK_TIME = 12
const FORMAT_OPTS = { useGroupSeparator: false as const, decimalsToShow: 18 }

export const BLOCK_TIME_BY_CHAIN: Record<number, number> = Object.fromEntries(
  NETWORKS_REGISTRY.flatMap((r) => r.networks)
    .filter((n) => n.blockTime != null)
    .map((n) => [n.chainId, n.blockTime!]),
)

export function getBlockTime(chainId: number): number {
  return BLOCK_TIME_BY_CHAIN[chainId] ?? DEFAULT_BLOCK_TIME
}

export function calcReserve(gasLimit: bigint, pricePerGas: bigint): string {
  return formattedAmountForDisplay(gasLimit * pricePerGas, 18, FORMAT_OPTS)
}

export function estimateSeconds(
  presetPriority: bigint,
  standardPriority: bigint,
  blockTime: number,
): FeeEstimateSeconds {
  if (standardPriority === 0n) {
    return { min: blockTime, max: blockTime * 4 }
  }

  const ratio = Number((presetPriority * 1000n) / standardPriority) / 1000
  if (ratio >= 1.4) return { min: blockTime, max: blockTime * 2 }
  if (ratio >= 0.9) return { min: blockTime, max: blockTime * 3 }

  return { min: blockTime, max: blockTime * 4 }
}

export function getFeePresets(tx: FeeDataInput): FeePreset[] {
  const builtTx = tx as any

  const { maxFeePerGas, maxPriorityFeePerGas, gasPrice } = builtTx.feeData ?? {}
  const gasLimit: bigint = builtTx.gasLimit
    ? BigInt(builtTx.gasLimit)
    : BigInt(builtTx.unsignedTx?.gasLimit ?? 21000)

  // EIP-1559
  if (maxFeePerGas != null && maxPriorityFeePerGas != null) {
    const priority = BigInt(maxPriorityFeePerGas)
    const baseFee = BigInt(maxFeePerGas) - BigInt(maxPriorityFeePerGas)
    const estimatedCostPerGas = (priority: bigint) => baseFee + priority
    const chainId: number = builtTx.unsignedTx?.chainId ?? 1
    const blockTime = getBlockTime(chainId)

    const lowPriority = (priority * 75n) / 100n
    const highPriority = (priority * 150n) / 100n

    const build = (
      label: FeePresetLabel,
      priority: bigint,
      seconds: FeeEstimateSeconds,
    ): FeePreset => {
      const presetMaxFeePerGas = baseFee + priority
      return {
        label,
        fees: {
          mode: 'eip1559',
          maxFeePerGas: presetMaxFeePerGas,
          maxPriorityFeePerGas: priority,
          gasLimit,
        },
        humanReadableGasReserve: calcReserve(gasLimit, presetMaxFeePerGas),
        humanReadableEstimatedCost: calcReserve(gasLimit, estimatedCostPerGas(priority)),
        estimatedSeconds: seconds,
      }
    }
    return [
      build('Low', lowPriority, estimateSeconds(lowPriority, priority, blockTime)),
      build('Standard', priority, estimateSeconds(priority, priority, blockTime)),
      build('High', highPriority, estimateSeconds(highPriority, priority, blockTime)),
    ]
  }

  // Legacy
  if (gasPrice != null) {
    const price = BigInt(gasPrice)

    const build = (
      label: FeePreset['label'],
      price: bigint,
      estimatedSeconds: FeeEstimateSeconds,
    ): FeePreset => ({
      label,
      fees: { mode: 'legacy', gasPrice: price, gasLimit } satisfies LegacyFees,
      humanReadableGasReserve: calcReserve(gasLimit, price),
      humanReadableEstimatedCost: calcReserve(gasLimit, price),
      estimatedSeconds,
    })

    return [
      build('Low', (price * 90n) / 100n, { min: 180, max: 180 }),
      build('Standard', price, { min: 60, max: 60 }),
      build('High', (price * 115n) / 100n, { min: 20, max: 20 }),
    ]
  }

  throw new Error('feeData missing from unsignedTx')
}
