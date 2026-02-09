/** npm imports */
import { Wallet, JsonRpcProvider } from 'ethers'

/** local imports */
import { TransactionRequest } from '../../types/common'

export const createWallet = (privateKey: string, rpcUrl?: string): Wallet =>
  new Wallet(privateKey, rpcUrl ? new JsonRpcProvider(rpcUrl) : undefined)

export const signMessage = async (privateKey: string, message: string): Promise<string> => {
  const wallet = createWallet(privateKey)
  return wallet.signMessage(message)
}

export const signTransaction = async (
  privateKey: string,
  tx: TransactionRequest,
  rpcUrl?: string,
): Promise<string> => {
  const wallet = createWallet(privateKey, rpcUrl)
  return wallet.signTransaction(tx)
}
