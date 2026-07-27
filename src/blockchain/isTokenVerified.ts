/** local imports */
import { BASIC_TOKENS_BY_CHAIN } from '../constants/BASIC_TOKENS_REGISTRY'

const VERIFIED_SET: Set<string> = new Set(
  Object.entries(BASIC_TOKENS_BY_CHAIN).flatMap(([chainId, tokens]) =>
    tokens
      .filter((t) => t.address !== null) //& native fuera: no se descubre, no se verifica por address
      .map((t) => `${chainId}:${t.address!.toLowerCase()}`),
  ),
)

export const isVerified = (chainId: number, tokenAddress: string): boolean =>
  VERIFIED_SET.has(`${chainId}:${tokenAddress.toLowerCase()}`)
