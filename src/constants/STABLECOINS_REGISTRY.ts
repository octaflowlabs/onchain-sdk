/** local imports */
import { normalizeEvmAddress } from '../utils/normalizeAddress'

export type StablecoinSymbol = 'USDC' | 'USDT' | 'OSC'

export interface StablecoinContractData {
  chainId: number
  symbol: StablecoinSymbol
  name: string
  address: string
  decimals: number
}

export type StablecoinContractsByChainId = Readonly<
  Record<number, readonly StablecoinContractData[]>
>

export const STABLECOIN_CONTRACTS_BY_CHAIN_ID: StablecoinContractsByChainId = {
  1: [
    {
      chainId: 1,
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    {
      chainId: 1,
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
  ],
  56: [
    {
      chainId: 56,
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      decimals: 18,
    },
    {
      chainId: 56,
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x55d398326f99059ff775485246999027b3197955',
      decimals: 18,
    },
  ],
  137: [
    {
      chainId: 137,
      symbol: 'USDC',
      name: 'USD Coin Bridged',
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      decimals: 6,
    },
    {
      chainId: 137,
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      decimals: 6,
    },
    {
      chainId: 137,
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      decimals: 6,
    },
  ],
  11155111: [
    {
      chainId: 11155111,
      symbol: 'USDC',
      name: 'Sepolia USDC',
      address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
      decimals: 6,
    },
    {
      chainId: 11155111,
      symbol: 'OSC',
      name: 'OSC Test Stablecoin',
      address: '0x4357555de1c8ed60218dd42b0b4f404e31b6d744',
      decimals: 6,
    },
  ],
}

export const getStablecoinContractsByChainId = (
  chainId: number | null | undefined,
): readonly StablecoinContractData[] => {
  if (chainId == null) return []
  return STABLECOIN_CONTRACTS_BY_CHAIN_ID[chainId] || []
}

export const getStablecoinContractBySymbolAndChainId = (
  symbol: StablecoinSymbol,
  chainId: number | null | undefined,
): StablecoinContractData | null => {
  const contracts = getStablecoinContractsByChainId(chainId)
  return contracts.find((contract) => contract.symbol === symbol) || null
}

export const isAllowedStablecoinContract = (
  chainId: number | null | undefined,
  contractAddress: string | null | undefined,
): boolean => {
  if (chainId == null) return false

  const normalizedAddress = normalizeEvmAddress(contractAddress)
  if (!normalizedAddress) return false

  const allowedContracts = getStablecoinContractsByChainId(chainId)
  if (!allowedContracts.length) return false

  return allowedContracts.some((contract) => contract.address === normalizedAddress)
}
