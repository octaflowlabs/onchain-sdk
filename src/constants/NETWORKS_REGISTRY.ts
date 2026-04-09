export const NETWORK_IDS = {
  ETHEREUM_MAINNET: 'ethereum-mainnet',
  BNB_SMART_CHAIN: 'bnb-smart-chain',
  POLYGON_MAINNET: 'polygon-mainnet',
  ARBITRUM_MAINNET: 'arbitrum-mainnet',
  SEPOLIA_ETH: 'sepolia-eth',
} as const

export type NetworkId = (typeof NETWORK_IDS)[keyof typeof NETWORK_IDS]
export type NetworkCategory = 'popular' | 'custom' | 'testnet'
export interface NetworkField {
  id: NetworkId
  category: NetworkCategory
  name: string
  nameForDisplay: string
  chainId: number
  rpcUrl: string
  explorerUrl: string
  iconUrl: string
  symbol: string
  failoverRpcUrl?: string
}

export const NETWORKS: Record<NetworkId, NetworkField> = {
  [NETWORK_IDS.ETHEREUM_MAINNET]: {
    id: NETWORK_IDS.ETHEREUM_MAINNET,
    category: 'popular',
    name: 'eth-mainnet',
    nameForDisplay: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerUrl: 'https://etherscan.io',
    iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    symbol: 'ETH',
    failoverRpcUrl: 'https://eth.llamarpc.com',
  },
  [NETWORK_IDS.BNB_SMART_CHAIN]: {
    id: NETWORK_IDS.BNB_SMART_CHAIN,
    category: 'popular',
    name: 'bnb-mainnet',
    nameForDisplay: 'BNB Smart Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.bnbchain.org',
    explorerUrl: 'https://bscscan.com/',
    iconUrl: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
    symbol: 'BNB',
    failoverRpcUrl: 'https://bsc.llamarpc.com',
  },
  [NETWORK_IDS.POLYGON_MAINNET]: {
    id: NETWORK_IDS.POLYGON_MAINNET,
    category: 'popular',
    name: 'polygon-mainnet',
    nameForDisplay: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: 'https://polygon.publicnode.com',
    explorerUrl: 'https://polygonscan.com',
    iconUrl: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
    symbol: 'POL',
    failoverRpcUrl: 'https://polygon.llamarpc.com',
  },
  [NETWORK_IDS.ARBITRUM_MAINNET]: {
    id: NETWORK_IDS.ARBITRUM_MAINNET,
    category: 'popular',
    name: 'arb-mainnet',
    nameForDisplay: 'Arbitrum Mainnet',
    chainId: 42161,
    rpcUrl: 'https://public-arb-mainnet.fastnode.io',
    explorerUrl: 'https://arbiscan.io',
    iconUrl: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg',
    symbol: 'ARB',
    failoverRpcUrl: 'https://arb.llamarpc.com',
  },
  [NETWORK_IDS.SEPOLIA_ETH]: {
    id: NETWORK_IDS.SEPOLIA_ETH,
    category: 'testnet',
    name: 'eth-sepolia',
    nameForDisplay: 'ETH Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    symbol: 'ETH',
    failoverRpcUrl: 'https://eth-sepolia.llamarpc.com',
  },
}

export const getNetworksByCategory = (category: NetworkCategory): NetworkField[] =>
  Object.values(NETWORKS).filter((n) => n.category === category)
