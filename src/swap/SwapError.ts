/**
 * SwapError — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-32  every anticipated failure of quoting, approval, swap-construction and
 *            lifecycle-reporting is a typed swap error carrying one code from the closed set
 *  - SDK-35  broadcastTransaction is untouched; submission failures stay untyped Error, not
 *            SwapError — enforced by absence, not by this file
 *  - FC-11   the consumer branches exhaustively on `code`; `message` is developer-facing only
 */

/** local imports */
import { SwapErrorCode } from '../types/swap'

export class SwapError extends Error {
  readonly code: SwapErrorCode
  readonly details?: unknown

  constructor(code: SwapErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'SwapError'
    this.code = code
    this.details = details
  }
}

export const isSwapError = (e: unknown): e is SwapError =>
  e instanceof SwapError && typeof (e as SwapError).code === 'string'
