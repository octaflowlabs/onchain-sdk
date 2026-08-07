/**
 * getSwapSettlement — spec 003-cross-chain-swap
 *
 * Satisfies:
 *  - CC-11  settlement is read from the routing service and reported as pending/success/failed,
 *           identified by the origin transaction's hash and the two chains it spans
 *  - CC-12  nothing beyond that hash and those two chain identifiers is required — no quote —
 *           so a consumer whose in-memory state was lost can resume from what it kept
 *  - CC-20  no timeout, deadline or maximum waiting period is imposed anywhere in this file
 *  - CC-22  no polling on the SDK's own behalf and no state retained between calls
 *  - CC-30  the settlement reason arrives as a field of the returned report, never as a
 *           raised error — this file adds no exception path beyond D-2's PROVIDER_ERROR case
 *
 * Deliberately thin (D-8): a public name and a stable signature over `fetchSettlement`, nothing
 * more. No `rpcUrl` — settlement reads no chain, only the routing service. No chain-support
 * guard, unlike every other swap operation: this one answers about funds already in flight, and
 * refusing because a chain left the supported set between broadcasting and asking would strand a
 * consumer mid-swap with no way to learn where the money went.
 */

/** local imports */
import { fetchSettlement } from './internal/lifiClient'
import { GetSwapSettlementParams, SwapSettlementReport } from '../types/swap'

export const getSwapSettlement = async ({
  txHash,
  fromChainId,
  toChainId,
}: GetSwapSettlementParams): Promise<SwapSettlementReport> =>
  fetchSettlement({ txHash, fromChainId, toChainId })
