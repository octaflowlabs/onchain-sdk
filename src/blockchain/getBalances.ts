/** npm imports */
import { Contract, Interface } from 'ethers'

/** local imports */
import { getProvider } from './getProvider'
import ERC20_TOKEN_CONTRACT_ABI from '../ABIs/ERC20_TOKEN_CONTRACT_ABI'
import MULTICALL3_ABI from '../ABIs/MULTICALL3_ABI'
import { MULTICALL3_ADDRESS } from '../constants/constants'
import { handleErrorMessages } from '../utils/handleErrorMessages'
import {
  ChainBalances,
  ChainGroup,
  GetBalanceParams,
  GetBalanceResult,
  GetBalancesParams,
  TokenBalance,
} from '../types/common'

export const getBalance = ({ walletAddress, rpcUrl, tokenAddress, chainId }: GetBalanceParams) => {
  const provider = getProvider(rpcUrl, chainId)
  if (!provider) throw new Error('Failed to create provider with the given RPC URL and chain ID.')

  try {
    if (!tokenAddress) return provider.getBalance(walletAddress)

    const tokenContract = new Contract(tokenAddress, ERC20_TOKEN_CONTRACT_ABI, provider)
    return tokenContract.balanceOf(walletAddress)
  } catch (error) {
    console.error('Error fetching balance:', error)
    handleErrorMessages({ e: error, message: 'Error fetching balance' })
  }
}

const buildChainKey = (rpcUrl: string, chainId?: number): string =>
  `${rpcUrl}|${chainId ?? 'default'}`

const buildRequestKey = ({
  walletAddress,
  rpcUrl,
  chainId,
  tokenAddress,
}: GetBalanceParams): string => {
  const walletKey = walletAddress.toLowerCase()
  const tokenKey = tokenAddress ? tokenAddress.toLowerCase() : 'native'
  const chainKey = chainId ?? 'default'

  return `${walletKey}|${rpcUrl}|${chainKey}|${tokenKey}`
}

const fetchTokenBalancesWithMulticall = async (
  walletAddress: string,
  tokenAddresses: string[],
  rpcUrl: string,
  chainId?: number,
): Promise<(bigint | null)[]> => {
  const provider = getProvider(rpcUrl, chainId)
  if (!provider) return tokenAddresses.map(() => null)

  try {
    const erc20Interface = new Interface(ERC20_TOKEN_CONTRACT_ABI)
    const multicall = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider)

    const calls = tokenAddresses.map((tokenAddress) => ({
      target: tokenAddress,
      allowFailure: true,
      callData: erc20Interface.encodeFunctionData('balanceOf', [walletAddress]),
    }))

    const results = await multicall.aggregate3.staticCall(calls)

    return results.map((result: { success: boolean; returnData: string }, index: number) => {
      if (!result.success || result.returnData === '0x') return null

      try {
        const decoded = erc20Interface.decodeFunctionResult('balanceOf', result.returnData)
        return decoded[0] as bigint
      } catch {
        console.error(`Failed to decode balance for token ${tokenAddresses[index]}`)
        return null
      }
    })
  } catch (error) {
    console.error('Multicall failed, falling back to individual calls:', error)
    return Promise.allSettled(
      tokenAddresses.map((tokenAddress) =>
        getBalance({ walletAddress, rpcUrl, tokenAddress, chainId }),
      ),
    ).then((results) => results.map((r) => (r.status === 'fulfilled' && r.value ? r.value : null)))
  }
}

export const getBalances = async ({
  walletAddress,
  chains: chainRequests,
}: GetBalancesParams): Promise<GetBalanceResult> => {
  const chainGroups = new Map<string, ChainGroup>()

  chainRequests.forEach(({ rpcUrl, chainId, tokenAddresses, includeNative }) => {
    const chainKey = buildChainKey(rpcUrl, chainId)

    if (!chainGroups.has(chainKey)) {
      chainGroups.set(chainKey, {
        rpcUrl,
        chainId,
        nativeBalanceRequests: [],
        tokenBalanceRequests: [],
      })
    }

    const group = chainGroups.get(chainKey)!

    if (includeNative) {
      const nativeRequest: GetBalanceParams = { walletAddress, rpcUrl, chainId }
      const key = buildRequestKey(nativeRequest)
      if (!group.nativeBalanceRequests.some((r) => buildRequestKey(r) === key))
        group.nativeBalanceRequests.push(nativeRequest)
    }

    tokenAddresses.forEach((tokenAddress) => {
      const request: GetBalanceParams = { walletAddress, rpcUrl, chainId, tokenAddress }
      const key = buildRequestKey(request)
      if (!group.tokenBalanceRequests.some((r) => buildRequestKey(r) === key))
        group.tokenBalanceRequests.push(request)
    })
  })

  const chainResults = await Promise.allSettled(
    Array.from(chainGroups.values()).map(async (group: ChainGroup): Promise<ChainBalances> => {
      const tokenBalances: TokenBalance[] = []

      const nativeResults = await Promise.allSettled(
        group.nativeBalanceRequests.map((request: GetBalanceParams) => getBalance(request)),
      )

      nativeResults.forEach((result) => {
        tokenBalances.push({
          tokenAddress: null,
          balance: result.status === 'fulfilled' ? (result.value ?? null) : null,
          error: result.status === 'rejected' ? result.reason : undefined,
        })
      })

      if (group.tokenBalanceRequests.length > 0) {
        const tokenAddresses = group.tokenBalanceRequests.map((r) => r.tokenAddress!)
        const balances = await fetchTokenBalancesWithMulticall(
          walletAddress,
          tokenAddresses,
          group.rpcUrl,
          group.chainId,
        )

        balances.forEach((balance, index) => {
          tokenBalances.push({
            tokenAddress: group.tokenBalanceRequests[index].tokenAddress ?? null,
            balance,
            error: balance === null ? 'Failed to fetch balance' : undefined,
          })
        })
      }

      return {
        chainId: group.chainId,
        balances: tokenBalances,
      }
    }),
  )

  const chainsWithBalances = chainResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => (result as PromiseFulfilledResult<ChainBalances>).value)

  return {
    walletAddress,
    chains: chainsWithBalances,
  }
}
