/**
 * resolveSwapState — spec 001-lifi-swap
 *
 * Satisfies:
 *  - SDK-25  the state is derived from the caller-supplied phase and outcome alone — no
 *            network access, no clock, no retained state between calls
 *  - SDK-26  a pending approval reports `approving`
 *  - SDK-27  no approval pending — none required, one already existed, or one just
 *            succeeded — reports `approved`
 *  - SDK-28  a pending swap reports `swapping`
 *  - SDK-29  `done` is reported only when the swap transaction succeeded, never otherwise
 *  - SDK-30  a failed transaction, in either phase, reports `error`
 *  - SDK-31  a caller unable to determine an outcome supplies `pending`, which resolves to
 *            `approving` or `swapping` per the supplied phase — never `done`, never `error`
 *  - FC-8    exactly five states; `approved` folds three distinct situations into one row
 *  - FC-9    the consumer owns the phase and the transaction hashes; this function infers
 *            neither
 *  - FC-10   `done` is reachable from exactly one cell of the table below
 *
 * D-9's eight-cell table, reproduced exactly:
 *
 * | phase      | outcome         | state       |
 * |------------|-----------------|-------------|
 * | approval   | pending         | approving   |
 * | approval   | success         | approved    |
 * | approval   | failed          | error       |
 * | approval   | not-submitted   | approving   |
 * | swap       | not-submitted   | approved    |
 * | swap       | pending         | swapping    |
 * | swap       | success         | done        |
 * | swap       | failed          | error       |
 */

/** local imports */
import { ResolveSwapStateParams, SwapState } from '../types/swap'

export const resolveSwapState = ({ phase, outcome }: ResolveSwapStateParams): SwapState => {
  if (outcome === 'failed') return 'error'

  if (phase === 'approval') {
    if (outcome === 'success') return 'approved'
    return 'approving'
  }

  if (outcome === 'not-submitted') return 'approved'
  if (outcome === 'success') return 'done'
  return 'swapping'
}
