/** npm imports */
import { Transaction } from 'ethers'

/** local imports */
import { getProvider } from './getProvider'
import { BroadcastTransactionOptions } from '../types/common'

export const broadcastTransaction = async ({
  signedTx,
  rpcUrl,
  chainId,
  waitConfirmations = 0,
}: BroadcastTransactionOptions): Promise<string> => {
  const provider = getProvider(rpcUrl, chainId)
  if (!provider) throw new Error('Could not create provider with given rpcUrl')

  try {
    Transaction.from(signedTx)
  } catch (error: any) {
    console.error('Invalid signed transaction format:', error)
    throw new Error('Invalid signed transaction format' + (error?.message || error || ''))
  }

  try {
    const txResponse = await provider.broadcastTransaction(signedTx)
    const txHash = txResponse.hash

    if (waitConfirmations && waitConfirmations > 0) await txResponse.wait(waitConfirmations)

    return txHash
  } catch (error: any) {
    console.error('Error computing transaction hash:', error)
    throw new Error(error?.message || error || 'Failed to broadcast transaction')
  }
}
