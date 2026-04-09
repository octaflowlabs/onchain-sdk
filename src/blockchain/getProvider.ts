/** npm imports */
import { JsonRpcProvider, Network } from 'ethers'

/** local imports */
import { NetworkId, NETWORKS } from '../constants/NETWORKS_REGISTRY'

export const getProvider = (rpcUrl: string, chainId?: number): JsonRpcProvider | undefined => {
  try {
    if (!chainId) return new JsonRpcProvider(rpcUrl)

    const network = Network.from(chainId)
    return new JsonRpcProvider(rpcUrl, network, { staticNetwork: network })
  } catch (error) {
    console.warn('Could not create provider with chainId, falling back to rpcUrl only:', error)
  }
}

export const getDefaultRpc = (networkId: NetworkId): string => NETWORKS[networkId].rpcUrl
