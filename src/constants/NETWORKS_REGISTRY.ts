export interface NetworkField {
  id: string
  name: string
  nameForDisplay: string
  chainId: number
  rpcUrl: string
  explorerUrl: string
  iconUrl: string
  symbol: string
  failoverRpcUrl?: string
  blockTime?: number
}

export interface NetworkRegistry {
  category: string
  networks: NetworkField[]
}

export const NETWORKS_REGISTRY: NetworkRegistry[] = [
  {
    category: 'popular',
    networks: [
      {
        id: 'ethereum-mainnet',
        name: 'eth-mainnet',
        nameForDisplay: 'Ethereum Mainnet',
        chainId: 1,
        rpcUrl: 'https://ethereum-rpc.publicnode.com',
        explorerUrl: 'https://etherscan.io',
        iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        symbol: 'ETH',
        failoverRpcUrl: 'https://eth.llamarpc.com',
        blockTime: 12,
      },
      {
        id: 'bnb-smart-chain',
        name: 'bnb-mainnet',
        nameForDisplay: 'BNB Smart Chain',
        chainId: 56,
        rpcUrl: 'https://bsc-dataseed.bnbchain.org',
        explorerUrl: 'https://bscscan.com',
        iconUrl: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
        symbol: 'BNB',
        failoverRpcUrl: 'https://bsc.llamarpc.com',
        blockTime: 3,
      },
      {
        id: 'polygon-mainnet',
        name: 'polygon-mainnet',
        nameForDisplay: 'Polygon Mainnet',
        iconUrl: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
        chainId: 137,
        rpcUrl: 'https://polygon.publicnode.com',
        explorerUrl: 'https://polygonscan.com',
        symbol: 'POL',
        failoverRpcUrl: 'https://polygon.llamarpc.com',
        blockTime: 2,
      },
      {
        id: 'arbitrum-mainnet',
        name: 'arb-mainnet',
        nameForDisplay: 'Arbitrum Mainnet',
        chainId: 42161,
        rpcUrl: 'https://public-arb-mainnet.fastnode.io',
        explorerUrl: 'https://arbiscan.io',
        iconUrl:
          'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg',
        symbol: 'ARB',
        failoverRpcUrl: 'https://arb.llamarpc.com',
        blockTime: 1,
      },
    ],
  },
  {
    category: 'custom',
    networks: [
      {
        id: 'sepolia-eth',
        name: 'eth-sepolia',
        nameForDisplay: 'ETH Sepolia Testnet',
        chainId: 11155111,
        rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
        explorerUrl: 'https://sepolia.etherscan.io',
        iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        symbol: 'ETH',
        failoverRpcUrl: 'https://eth-sepolia.llamarpc.com',
        blockTime: 12,
      },
    ],
  },
]
