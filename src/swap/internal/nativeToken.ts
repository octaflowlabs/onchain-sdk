/**
 * Native token detection — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-14  where the input is native, no approval transaction is produced
 *
 * Detection is by address, never by symbol (D-6). Verified against
 * `GET https://li.quest/v1/tokens` on 2026-07-29: the native currency sits at the zero
 * address on every chain checked, whatever its symbol — ETH on Base, BNB on BSC, AVAX on
 * Avalanche, xDAI on Gnosis, HYPE on HyperEVM. No chain exposes the `0xEeee…` placeholder
 * used by some other aggregators.
 */

/** local imports */
import { normalizeEvmAddress } from '../../utils/normalizeAddress'

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export const isNativeTokenAddress = (address: string | null | undefined): boolean =>
  normalizeEvmAddress(address) === NATIVE_TOKEN_ADDRESS
