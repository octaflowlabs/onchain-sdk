/** npm imports */
import { TransactionRequest } from 'ethers'

/** local imports */
import { EstimateGasLimitFromProviderProps, GasEstimateResult } from '../types/common'
import {
  errorMessagesForGasLimitEstimation,
  handleErrorMessages,
} from '../utils/handleErrorMessages'

export const estimateGasLimitFromProvider = async ({
  provider,
  unsignedTx,
  walletAddress,
  defaultGasLimit,
}: EstimateGasLimitFromProviderProps): Promise<GasEstimateResult> => {
  let lastFeeData: Awaited<ReturnType<typeof provider.getFeeData>> | null = null
  let lastGasEstimated: bigint | null = null

  try {
    const feeData = await provider.getFeeData()
    lastFeeData = feeData

    const txForEstimation: TransactionRequest = { ...unsignedTx, from: walletAddress }

    if (feeData.maxFeePerGas !== undefined) txForEstimation.maxFeePerGas = feeData.maxFeePerGas
    if (feeData.maxPriorityFeePerGas !== undefined)
      txForEstimation.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
    if (feeData.gasPrice !== undefined && txForEstimation.maxFeePerGas === undefined)
      txForEstimation.gasPrice = feeData.gasPrice

    const gasEstimated: bigint = await provider.estimateGas(txForEstimation)
    lastGasEstimated = gasEstimated

    let congestionFactor = 1.5
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      try {
        const maxFee = Number(feeData.maxFeePerGas)
        const maxPriorityFee = Math.max(Number(feeData.maxPriorityFeePerGas), 1)
        const ratio = maxFee / maxPriorityFee
        if (isFinite(ratio) && ratio > 0) congestionFactor = ratio
      } catch {
        congestionFactor = 1.5
      }
    }

    const bufferPercentage = Math.min(Math.max(Math.round(congestionFactor * 5), 5), 30) // 5% to 30% buffer
    const newGasLimit = gasEstimated + (gasEstimated * BigInt(bufferPercentage)) / BigInt(100)

    // let suggested: GasFeesApiResponse | undefined = undefined
    // try {
    //   suggested = await this.getSuggestedGasPrice((await provider.getNetwork()).chainId)
    // } catch {
    //   suggested = undefined
    // }

    return {
      gasEstimated,
      gasLimit: newGasLimit,
      bufferPercentage,
      fallbackUsed: false,
      feeData: {
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
        gasPrice: feeData.gasPrice ?? undefined,
      },
      // suggestedGasFees: suggested,
    }
  } catch (error: any) {
    handleErrorMessages({
      e: error,
      message: errorMessagesForGasLimitEstimation[error.code] || 'Failed to estimate gas limit',
    })
    console.log(`Setting default gas limit to: ${defaultGasLimit}`)

    const feeData = lastFeeData
    const gasEstimated = lastGasEstimated ?? defaultGasLimit

    return {
      gasEstimated,
      gasLimit: defaultGasLimit,
      bufferPercentage: 0,
      fallbackUsed: true,
      feeData: feeData
        ? {
            maxFeePerGas: feeData.maxFeePerGas ?? undefined,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
            gasPrice: feeData.gasPrice ?? undefined,
          }
        : {},
    }
  }
}
