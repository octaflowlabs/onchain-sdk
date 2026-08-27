# 004 — Plan

**Depends on:** ethers v6.16 (already the pinned dependency — `package.json`), no new
dependency added. **Consumed by:** `keywalletmobileapp` spec
[005-cryptnox-card-signing](../../../key-wallet/keywalletmobileapp/specs/005-cryptnox-card-signing/)
T-1, which is blocked on this shipping.

## Where this lives

New files, mirroring the existing `evm-wallet-core` split between "raw signing" (`signer.ts`) and
"everything that resolves what to sign" (`prepareTransaction.ts`, `estimateTransaction.ts`):

- `src/services/evm-wallet-core/externalSigner.ts` — `signTransactionWithSigner`,
  `signMessageWithSigner`.
- `src/types/externalSigner.ts` — `ExternalSigner`.
- `src/signing/ExternalSignerError.ts` — `ExternalSignerError`, `isExternalSignerError`, mirroring
  `src/swap/SwapError.ts` exactly (same shape: `code`, `message`, `details`, a type guard). Two
  codes: `ES_SIGNATURE_MISMATCH` (ES-7, ES-11) and `ES_UNRESOLVED_TRANSACTION` (ES-14, added when
  OQ-3 was resolved in favor of failing fast).
- Exported from `src/index.ts` alongside the existing `signer.ts` exports (FC-E8).

## D-1 — Compute the digest directly; do not subclass `ethers.AbstractSigner`

`ethers.AbstractSigner` was the first idea: override `signTransaction`/`signMessage`, inherit
`getAddress`, `connect`, `populateTransaction`, done. Rejected. `AbstractSigner`'s
`populateTransaction` exists to resolve chain id, nonce, gas and type from a provider — exactly
what `prepareTransaction` already does, as its own operation, called separately by every existing
consumer. Subclassing `AbstractSigner` would give this SDK two independent paths to the same
resolution (one already public, one newly private inside the subclass), which is the duplication
CLAUDE.md's "no reimplementation" rule forbids applied to this repo's own code — and ES-3 exists
precisely to say the new operation does not do this a second time.

The direct approach instead mirrors exactly what `Wallet.signTransaction` already does internally,
substituting the last step:

```ts
// transaction
const populated = Transaction.from(tx) // tx is prepareTransaction's fully-resolved output
const digest = keccak256(populated.unsignedSerialized)
const signature = await signer.signDigest(digest) // was: this.signingKey.sign(digest)
populated.signature = Signature.from(signature)
return populated.serialized

// message
const digest = hashMessage(message) // was: hashMessage, then signingKey.sign
const signature = await signer.signDigest(digest)
return Signature.from(signature).serialized
```

No `AbstractSigner`, no `connect`, no `populateTransaction` override — `signTransactionWithSigner`
and `signMessageWithSigner` are functions, exactly like `signTransaction`/`signMessage` are today,
not a `Signer` class. `TransactionRequest` and `Transaction` are the only ethers types touched
beyond what `signer.ts` already imports.

## D-2 — Recovered-address check happens after `Signature.from`, before returning

ethers exposes the recovery as `Transaction.from(signedTx).from` for a signed transaction, and
`ethers.verifyMessage(message, signature)` for a message — both wrap the same
`SigningKey.recoverPublicKey`/`computeAddress` machinery `ecrecover` needs. Neither requires
`signer.address` as an input; it is only used for the comparison (ES-7). Comparing
case-insensitively (`getAddress(...).toLowerCase()`, i.e. after checksum-normalizing both sides)
avoids a false mismatch from a caller supplying a non-checksummed address.

## D-3 — `ExternalSignerError` mirrors `SwapError`, not a subclass of it

A signature mismatch is not a swap concern and `keywalletmobileapp`'s own rule — narrow errors by
their own SDK's type guard, never assume `.code` — means every feature's error class must be
independently narrowable. `isSwapError(e)` must stay `false` for an `ExternalSignerError` and
vice versa; a shared base class risks a consumer's `catch` narrowing on the wrong one. Full
duplication of the four-line shape costs nothing and removes the risk.

## D-4 — `signDigest`'s rejection passes through unmodified (ES-10)

The implementation must not wrap the `await signer.signDigest(digest)` call in a `try/catch` that
rethrows, even to attach context — `async`/`await` alone already propagates a rejection unchanged
to the caller of `signTransactionWithSigner`. The risk is a well-intentioned
`catch (e) { throw new Error('Signing failed: ' + e.message) }` added later "for a better error
message," which is exactly the wrapping ES-10 and the consumer's own FC-E6 forbid: it would
turn a card's classified `CryptnoxCardError` (with its own `.code`) into a plain `Error` the
consumer can no longer narrow.

## Open implementation questions

**All three are now resolved** in [spec.md](./spec.md) §Open questions. OQ-1 and OQ-2 were closed
by running this plan's own D-1 sketch against a `Wallet`-backed signer and diffing the output
against `signTransaction`'s — byte-identical across all three fee shapes. OQ-3 was decided in
favor of failing fast, adding clause ES-14 and a second error code.

Two corrections came out of that measurement and are carried into the sections above:

- **`gasPrice`-only is type 1 (EIP-2930), not type 0.** `inferType()` pops the last of
  `inferTypes()`'s `[0, 1]`. ES-4 was reworded to delegate to `inferType()` rather than restate
  the rule. `Wallet.signTransaction` already behaves this way, so nothing about the existing
  private-key path changes.
- **D-1's `Signature.from(signature)` line is where FC-E3's `v → yParity` conversion happens** —
  it derives both from the 65-byte input. Do not hand-compute `v - 27` anywhere.

## Verification

No test runner exists in this repo (`package.json` has `build`, `prettier`,
`prepublishOnly` only) — verification is `yarn build` (typecheck) plus exercising the two new
operations against a real signer. The cheapest real signer for local verification is a
`Wallet`-backed one: wrap an `ethers.Wallet`'s own `signingKey.sign(digest)` in the
`ExternalSigner` shape and confirm `signTransactionWithSigner`/`signMessageWithSigner` produce
byte-identical output to `signTransaction`/`signMessage` given the same inputs. That closed OQ-1
and OQ-2 without needing hardware — already run against the D-1 sketch at design time; the
implementation tasks re-run it against the real functions rather than the sketch. Verifying against
an actual Cryptnox card is `keywalletmobileapp`'s job, downstream, once this ships.
