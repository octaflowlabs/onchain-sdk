/**
 * External signer types — spec 004-external-signer
 *
 * Satisfies:
 *  - ES-1   ExternalSigner is { address, signDigest }, where digest is a 0x-prefixed 32-byte hex
 *           string and the returned signature is a 0x-prefixed 65-byte hex string
 *           (r ‖ s ‖ v, v ∈ {27, 28})
 *  - ES-2   nothing on this shape is, holds or derives a private key; address is supplied by the
 *           caller and never computed from key material the SDK holds
 *  - FC-E5  no path through either operation requires, derives or accepts a private key
 *  - FC-E8  importable from the package entry point
 */

export type ExternalSigner = {
  address: string
  signDigest: (digest: string) => Promise<string>
}
