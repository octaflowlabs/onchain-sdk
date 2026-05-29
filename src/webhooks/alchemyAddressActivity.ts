/** local imports */
import { isAllowedStablecoinContract } from '../constants/STABLECOINS_REGISTRY'
import { getTransactionActivityDedupeKey } from '../utils/activityDedupe'
import { normalizeEvmAddress } from '../utils/normalizeAddress'

const CHAIN_ID_TO_ALCHEMY_NETWORK: Readonly<Record<number, string>> = {
  1: 'ETH_MAINNET',
  56: 'BNB_MAINNET',
  137: 'MATIC_MAINNET',
  11155111: 'ETH_SEPOLIA',
}

const ALCHEMY_NETWORK_TO_CHAIN_ID: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(CHAIN_ID_TO_ALCHEMY_NETWORK).map(([chainId, network]) => [
    network,
    Number(chainId),
  ]),
)

export interface AlchemyAddressActivity {
  category?: string
  asset?: string
  value?: number | null
  fromAddress?: string | null
  toAddress?: string | null
  hash?: string | null
  erc721TokenId?: string | number | null
  rawContract?: {
    address?: string | null
  } | null
  log?: {
    removed?: boolean
    logIndex?: string | null
  } | null
}

export interface AlchemyAddressActivityPayload {
  id?: string
  webhookId?: string
  type?: string
  event?: {
    network?: string
    activity?: AlchemyAddressActivity[]
  }
}

export interface PoolInboundStablecoinEvent {
  webhookDeliveryId?: string
  webhookId?: string
  alchemyNetwork: string
  chainId: number | null
  txHash: string
  fromAddress: string
  toAddress: string
  amount: number
  asset: string
  tokenContractAddress?: string | null
  dedupeKey: string
}

function chainIdFromAlchemyNetwork(network: string | undefined): number | null {
  if (!network) return null
  const chainId = ALCHEMY_NETWORK_TO_CHAIN_ID[network]
  return chainId === undefined ? null : chainId
}

export function extractPoolInboundStablecoinEvents(
  payload: AlchemyAddressActivityPayload,
  poolAddress: string | null | undefined,
): PoolInboundStablecoinEvent[] {
  const poolAddressLower = normalizeEvmAddress(poolAddress)
  if (!poolAddressLower) return []
  if (payload.type !== 'ADDRESS_ACTIVITY') return []

  const network = payload.event?.network
  const chainId = chainIdFromAlchemyNetwork(network)
  const activity = payload.event?.activity
  if (!activity?.length) return []

  const out: PoolInboundStablecoinEvent[] = []

  for (const item of activity) {
    if (item.category !== 'token') continue
    if (item.log?.removed === true) continue
    if (item.erc721TokenId != null && item.erc721TokenId !== '') continue
    if (!isAllowedStablecoinContract(chainId, item.rawContract?.address)) continue

    const value = item.value
    if (value === undefined || value === null || typeof value !== 'number' || !(value > 0)) continue

    const to = normalizeEvmAddress(item.toAddress)
    const from = normalizeEvmAddress(item.fromAddress)
    if (!to || !from) continue
    if (to !== poolAddressLower) continue

    const txHash = item.hash?.trim()
    if (!txHash) continue

    const dedupeKey = getTransactionActivityDedupeKey(item)
    if (!dedupeKey) continue

    out.push({
      webhookDeliveryId: payload.id,
      webhookId: payload.webhookId,
      alchemyNetwork: network || 'UNKNOWN',
      chainId,
      txHash,
      fromAddress: from,
      toAddress: to,
      amount: value,
      asset: item.asset || '',
      tokenContractAddress: item.rawContract?.address,
      dedupeKey,
    })
  }

  return out
}
