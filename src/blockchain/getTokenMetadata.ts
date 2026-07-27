/** npm imports */
import { Contract, Interface, decodeBytes32String } from 'ethers'

/** local imports */
import { getProvider } from './getProvider'
import ERC20_TOKEN_CONTRACT_ABI from '../ABIs/ERC20_TOKEN_CONTRACT_ABI'
import MULTICALL3_ABI from '../ABIs/MULTICALL3_ABI'
import { MULTICALL3_ADDRESS } from '../constants/constants'

export interface GetTokenMetadataParams {
  rpcUrl: string
  chainId?: number
  tokenAddresses: string[]
}

export interface TokenMetadata {
  address: string
  decimals: number | null
  symbol: string | null
  name: string | null
}

type Multicall3Result = { success: boolean; returnData: string }

const decodeUint8 = (iface: Interface, fn: string, res?: Multicall3Result): number | null => {
  if (!res?.success || res.returnData === '0x') return null

  try {
    return Number(iface.decodeFunctionResult(fn, res.returnData)[0])
  } catch {
    return null
  }
}

const decodeStringOrBytes32 = (
  iface: Interface,
  fn: string,
  res?: Multicall3Result,
): string | null => {
  if (!res?.success || res.returnData === '0x') return null
  try {
    const [val] = iface.decodeFunctionResult(fn, res.returnData)
    return typeof val === 'string' && val.length ? val : null
  } catch {
    try {
      const s = decodeBytes32String(res.returnData)
      return s.length ? s : null
    } catch {
      return null
    }
  }
}

export const getTokenMetadata = async ({
  rpcUrl,
  chainId,
  tokenAddresses,
}: GetTokenMetadataParams): Promise<TokenMetadata[]> => {
  if (!tokenAddresses.length) return []

  const provider = getProvider(rpcUrl, chainId)

  const empty = () =>
    tokenAddresses.map((address) => ({ address, decimals: null, symbol: null, name: null }))

  if (!provider) return empty()

  const erc20 = new Interface(ERC20_TOKEN_CONTRACT_ABI)
  const multicall = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider)

  const calls = tokenAddresses.flatMap((target) => [
    { target, allowFailure: true, callData: erc20.encodeFunctionData('decimals') },
    { target, allowFailure: true, callData: erc20.encodeFunctionData('symbol') },
    { target, allowFailure: true, callData: erc20.encodeFunctionData('name') },
  ])

  let results: Multicall3Result[]

  try {
    results = await multicall.aggregate3.staticCall(calls)
  } catch (error) {
    console.error('Multicall metadata failed, returning nulls:', error)
    return empty()
  }

  return tokenAddresses.map((address, i) => ({
    address,
    decimals: decodeUint8(erc20, 'decimals', results[i * 3]),
    symbol: decodeStringOrBytes32(erc20, 'symbol', results[i * 3 + 1]),
    name: decodeStringOrBytes32(erc20, 'name', results[i * 3 + 2]),
  }))
}
