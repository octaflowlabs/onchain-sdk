/** local imports */
import { estimateGasLimitFromProvider } from './estimateGasLimitFromProvider'
import { getProvider } from './getProvider'
import { EstimateTransactionOptions, EstimateTransactionResult } from '../types/common'
import { formatUnits } from 'ethers'

export const estimateTransaction = async ({
  rpcUrl,
  chainId,
  tx,
  fromAddress,
  defaultGasLimit,
}: EstimateTransactionOptions): Promise<EstimateTransactionResult> => {
  const provider = getProvider(rpcUrl, chainId)
  if (!provider) throw new Error('Could not get provider')

  const estimateGas = await estimateGasLimitFromProvider({
    provider,
    unsignedTx: tx,
    walletAddress: fromAddress,
    defaultGasLimit: defaultGasLimit || 21000n,
  })

  const gasReserve = estimateGas.feeData.maxFeePerGas
    ? estimateGas.gasLimit * estimateGas.feeData.maxFeePerGas
    : estimateGas.feeData.gasPrice
      ? estimateGas.gasLimit * estimateGas.feeData.gasPrice
      : undefined

  const humanReadableGasReserve = gasReserve ? `${formatUnits(gasReserve, 18)}` : 'N/A'

  return {
    gasLimit: estimateGas.gasLimit,
    gasEstimated: estimateGas.gasEstimated,
    feeData: estimateGas.feeData,
    gasReserve,
    humanReadableGasReserve,
    bufferPercentage: estimateGas.bufferPercentage,
  }
}
