/**
 * Supported chain set — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-7  supported means present both in LI.FI's supported set and in NETWORKS_REGISTRY
 *  - SDK-8  a chain outside that intersection fails with UNSUPPORTED_CHAIN
 *  - FC-12  the SDK publishes the chain list; the consumer does not maintain its own
 *
 * Verified against `GET https://li.quest/v1/chains?chainTypes=EVM` (69 EVM chains returned)
 * on 2026-07-28: every mainnet in NETWORKS_REGISTRY is supported by LI.FI. Only Sepolia
 * (11155111), a testnet, falls outside the intersection. Re-run that request and update this
 * list by hand whenever a chain is added to or removed from NETWORKS_REGISTRY.
 */

export const SWAP_SUPPORTED_CHAIN_IDS = [
  1, // Ethereum
  10, // Optimism
  56, // BSC
  100, // Gnosis
  130, // Unichain
  137, // Polygon
  999, // HyperEVM
  5000, // Mantle
  8453, // Base
  9745, // Plasma
  42161, // Arbitrum
  43114, // Avalanche
  59144, // Linea
  80094, // Berachain
  81457, // Blast
  534352, // Scroll
] as const

export const getSwapSupportedChainIds = (): number[] => [...SWAP_SUPPORTED_CHAIN_IDS]

export const isSwapSupportedChain = (chainId: number): boolean =>
  (SWAP_SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId)
