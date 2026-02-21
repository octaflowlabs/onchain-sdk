/** npm imports */
import { TransactionRequest } from 'ethers'

/** local imports */
import { estimateTransaction } from './estimateTransaction'
import { getProvider } from './getProvider'
import { PrepareTransactionParams, PrepareTransactionResult } from '../types/common'

export const prepareTransaction = async ({
  rpcUrl,
  chainId,
  tx,
  fromAddress,
  defaultGasLimit,
}: PrepareTransactionParams): Promise<PrepareTransactionResult> => {
  const provider = getProvider(rpcUrl, chainId)
  if (!provider) throw new Error('Could not create provider')

  const estimation = await estimateTransaction({
    rpcUrl,
    chainId,
    tx,
    fromAddress,
    defaultGasLimit,
  })

  const nonce = await provider.getTransactionCount(fromAddress, 'pending')

  const preparedTx: TransactionRequest = {
    from: fromAddress,
    to: tx.to,
    data: tx.data,
    value: tx.value,
    gasLimit: estimation.gasLimit,
    chainId,
    nonce,
    maxFeePerGas: estimation.feeData.maxFeePerGas,
    maxPriorityFeePerGas: estimation.feeData.maxPriorityFeePerGas,
  }

  if (estimation.feeData.gasPrice) preparedTx.gasPrice = estimation.feeData.gasPrice

  return {
    unsignedTx: preparedTx,
    nonce,
    gasEstimated: estimation.gasEstimated,
    gasLimit: estimation.gasLimit,
    gasReserve: estimation.gasReserve,
    bufferPercentage: estimation.bufferPercentage,
    feeData: {
      maxFeePerGas: estimation.feeData.maxFeePerGas,
      maxPriorityFeePerGas: estimation.feeData.maxPriorityFeePerGas,
      gasPrice: estimation.feeData.gasPrice,
    },
    humanReadableGasReserve: estimation.humanReadableGasReserve,
  }
}
