/**
 * ExternalSignerError — spec 004-external-signer
 *
 * Satisfies:
 *  - ES-7   ES_SIGNATURE_MISMATCH is raised when the recovered address is not signer.address
 *  - ES-11  ES_SIGNATURE_MISMATCH is the SDK's own error, distinguishable from anything
 *           signDigest can throw
 *  - ES-14  ES_UNRESOLVED_TRANSACTION is raised when tx lacks a field ES-3 assumes resolved
 *  - FC-E4  a distinguishable error, rather than a transaction signed by an unexpected key
 *  - FC-E8  importable from the package entry point
 *
 * Plan D-3: mirrors swap/SwapError.ts rather than extending or sharing a base class with it, so
 * isSwapError and isExternalSignerError never both hold for the same value.
 */

export type ExternalSignerErrorCode = 'ES_SIGNATURE_MISMATCH' | 'ES_UNRESOLVED_TRANSACTION'

export class ExternalSignerError extends Error {
  readonly code: ExternalSignerErrorCode
  readonly details?: unknown

  constructor(code: ExternalSignerErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ExternalSignerError'
    this.code = code
    this.details = details
  }
}

export const isExternalSignerError = (e: unknown): e is ExternalSignerError =>
  e instanceof ExternalSignerError && typeof (e as ExternalSignerError).code === 'string'
