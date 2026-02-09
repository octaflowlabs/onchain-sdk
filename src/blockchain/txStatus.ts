/** local imports */
import { getProvider } from './getProvider'
import { TxStatusOptions, TxStatusResponse } from '../types/common'

export const txStatus = async ({
  rpcUrl,
  txHash,
  chainId,
}: TxStatusOptions): Promise<TxStatusResponse> => {
  const provider = getProvider(rpcUrl, chainId)
  if (!provider) throw new Error('Could not create provider with given rpcUrl and chainId')

  try {
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) return { success: false, receipt: null }
    return { success: receipt.status === 1, receipt }
  } catch (error: any) {
    console.log('Error checking transaction status:', error)
    return { success: false, receipt: null }
  }
}
