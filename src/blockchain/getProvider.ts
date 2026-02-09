/** npm imports */
import { JsonRpcProvider, Network } from 'ethers'

export const getProvider = (rpcUrl: string, chainId?: number): JsonRpcProvider | undefined => {
  try {
    if (!chainId) return new JsonRpcProvider(rpcUrl)

    const network = Network.from(chainId)
    return new JsonRpcProvider(rpcUrl, network, { staticNetwork: network })
  } catch (error) {
    console.warn('Could not create provider with chainId, falling back to rpcUrl only:', error)
  }
}
