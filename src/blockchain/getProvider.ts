/** npm imports */
import { JsonRpcProvider, Network } from 'ethers'

export const getProvider = (rpcUrl: string, chainId?: number): JsonRpcProvider | undefined => {
  try {
    if (chainId) {
      const network = Network.from(chainId)
      return new JsonRpcProvider(rpcUrl, network, { staticNetwork: network })
    } else {
      return new JsonRpcProvider(rpcUrl)
    }
  } catch (error) {
    console.warn('Could not create provider with chainId, falling back to rpcUrl only:', error)
  }
}
