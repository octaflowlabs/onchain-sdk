/**
 * getAllSwapTokens — spec 002-token-registry
 *
 * Satisfies:
 *  - TR-11  every requested chain's full token list is returned, keyed by chain id
 *  - TR-13  a chain outside the supported set fails with UNSUPPORTED_CHAIN, before any network
 *           access
 *  - TR-14  an upstream failure fails the whole call; no chain is returned partially
 *  - TR-15  no ordering is imposed on a chain's list; the upstream order passes through
 *  - TR-20  an empty request returns an empty result without touching the network
 *
 * Guard order (D-6): empty input first, then the chain guard, then the network call, then the
 * mapping — cheapest checks first, network last.
 */

/** local imports */
import { SwapError } from './SwapError'
import { fetchTokensForChains, toSwapToken } from './internal/lifiClient'
import { isSwapSupportedChain } from '../constants/SWAP_SUPPORTED_CHAINS'
import { GetAllSwapTokensParams, SwapToken } from '../types/swap'

export const getAllSwapTokens = async ({
  chainIds,
}: GetAllSwapTokensParams): Promise<Record<number, SwapToken[]>> => {
  if (chainIds.length === 0) return {}

  const uniqueChainIds = [...new Set(chainIds)]
  const unsupportedChainIds = uniqueChainIds.filter((chainId) => !isSwapSupportedChain(chainId))

  if (unsupportedChainIds.length > 0)
    throw new SwapError(
      'UNSUPPORTED_CHAIN',
      `Chain(s) ${unsupportedChainIds.join(', ')} are not supported for swaps`,
      { chainIds: unsupportedChainIds },
    )

  const tokensByChain = await fetchTokensForChains(uniqueChainIds)

  const result: Record<number, SwapToken[]> = {}
  for (const chainId of uniqueChainIds) result[chainId] = tokensByChain[chainId].map(toSwapToken)

  return result
}
