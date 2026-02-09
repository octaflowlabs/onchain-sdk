/** npm imports */
import { Transaction } from 'ethers'

/** local imports */
import { getProvider } from './getProvider'
import { BroadcastTransactionOptions } from '../types/common'
import { errorMessagesForBroadcast, handleErrorMessages } from '../utils/handleErrorMessages'
import { ensurePublicHost, testJsonRpc } from '../rpc'

export const broadcastTransaction = async ({
  signedTx,
  rpcUrl,
  chainId,
  waitConfirmations = 0,
}: BroadcastTransactionOptions): Promise<string> => {
  await ensurePublicHost(rpcUrl)
  await testJsonRpc(rpcUrl, 'eth_chainId', [])

  const provider = getProvider(rpcUrl, chainId)
  if (!provider) throw new Error('Could not create provider with given rpcUrl')

  try {
    Transaction.from(signedTx)
  } catch (error: any) {
    handleErrorMessages({
      e: error,
      message: errorMessagesForBroadcast[error.code] || 'Invalid signed transaction format',
    })
    throw new Error('Invalid signed transaction format' + (error?.message || error || ''))
  }

  try {
    const txResponse = await provider.broadcastTransaction(signedTx)
    const txHash = txResponse.hash

    if (waitConfirmations && waitConfirmations > 0) await txResponse.wait(waitConfirmations)

    return txHash
  } catch (error: any) {
    handleErrorMessages({
      e: error,
      message: errorMessagesForBroadcast[error.code] || 'Failed to broadcast transaction',
    })
    throw new Error(error?.message || error || 'Failed to broadcast transaction')
  }
}
