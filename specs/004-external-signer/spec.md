# 004 — External signer

**Status:** draft · **Owner:** SDK · **Consumers:** `keywalletmobileapp`, spec
[005-cryptnox-card-signing](../../../key-wallet/keywalletmobileapp/specs/005-cryptnox-card-signing/)

**Clause identifiers** — this spec numbers its internal clauses `ES-n` (SDK behavior). It does
**not** continue 001's `SDK-n`, 002's `TR-n` or 003's `CC-n` series: those identifiers are stable
and already referenced from the consuming repo, so reusing the numbering would make every
existing reference ambiguous. Its frontend-contract clauses are **not** a fresh series either —
they are `FC-E1` … `FC-E7`, already fixed by the consumer's own plan
(`keywalletmobileapp/specs/005-cryptnox-card-signing/plan.md` §SDK contract required) before this
spec existed. That document states them as "the guarantees this app depends on, to become `FC-E`
clauses there" — this spec is where they become that. Their wording below is unchanged from that
source; a clause that merely reworded one would be a defect, per that repo's own rule for citing
this one.

## Purpose

Every signing operation this SDK exposes today — `signTransaction`, `signMessage` — takes a
private key and produces a signature by holding it in memory for the span of one `ethers.Wallet`
call. That is wrong for a caller whose private key never leaves a piece of hardware it does not
control: a Cryptnox NFC card, a Secure Enclave key, eventually a hardware wallet over Bluetooth.
Today those callers cannot use this SDK for signing at all — the entry point requires the one
thing they are built specifically not to hold.

This spec adds a second way to sign: give the SDK a **digest signer** — something that can turn a
32-byte digest into a signature, however it does that — in place of a private key. Everything
between "here is a transaction" and "here is a digest" stays exactly what it already is. Nothing
about _what_ gets signed changes; only _who signs it_ does.

## Domain vocabulary

| Term                  | Meaning                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **External signer**   | Something that can sign a digest without exposing, deriving or requiring a private key — this spec's `ExternalSigner`.                                                                                             |
| **Digest**            | The 32-byte hash a signature is actually computed over: a transaction's signing hash, or a message's EIP-191 hash. Never the transaction or message itself.                                                        |
| **Recovered address** | The address `ecrecover` returns given a digest and a signature. Equal to the signer's own address only if that signer actually produced the signature.                                                             |
| **Signing digest**    | Unchanged concept from `signTransaction`/`signMessage`: what `ethers.Wallet` computes internally before calling into the private key. This spec makes it an explicit, externally-visible value for the first time. |

## SDK behavior

Internal guarantees. Each clause is one acceptance criterion.

### The signer shape

- **ES-1** — THE SDK SHALL define `ExternalSigner` as `{ address: string; signDigest: (digest:
string) => Promise<string> }`, where `digest` is a `0x`-prefixed 32-byte hex string and the
  returned signature is a `0x`-prefixed 65-byte hex string (`r ‖ s ‖ v`, `v ∈ {27, 28}`).
- **ES-2** — THE SDK SHALL NOT require, accept, derive or construct a private key anywhere on the
  path from `signTransactionWithSigner` or `signMessageWithSigner` to `signDigest`. `address` is
  supplied by the caller and is never derived from a key material the SDK holds.

### Transaction signing

- **ES-3** — THE SDK SHALL accept, as `signTransactionWithSigner`'s `tx` parameter, the same
  `TransactionRequest` shape `signTransaction` accepts today — in particular, the already-resolved
  shape `prepareTransaction` returns (`chainId`, `nonce`, `gasLimit`, and either
  `maxFeePerGas`/`maxPriorityFeePerGas` or `gasPrice` already set). It SHALL NOT require the
  caller to resolve anything `signTransaction` would otherwise resolve for them.
- **ES-4** — THE SDK SHALL determine the transaction's type by delegating to `ethers.Transaction`'s
  own `inferType()`, the same rule `signTransaction` already relies on today, and SHALL NOT
  reimplement that inference. This spec introduces no new rule; it only names the existing one as a
  guarantee, because a caller with no private key has no other way to observe that
  `signTransaction` was relying on it. Measured against ethers 6.16 (see OQ-1), that rule resolves
  to: **type 2** when `maxFeePerGas`/`maxPriorityFeePerGas` are present (including when `gasPrice`
  is _also_ present, which is what `prepareTransaction` emits); **type 1** when only `gasPrice` is
  present; **type 0** only when the caller sets `type: 0` explicitly. The SDK never sets `type`
  itself.
- **ES-5** — THE SDK SHALL compute the transaction's signing digest itself, from the fully-resolved
  `TransactionRequest`, and SHALL pass exactly that digest to `signDigest` — nothing pre-hashed by
  the caller, nothing the caller must hash again.
- **ES-6** — WHEN `signDigest` resolves, THE SDK SHALL attach the returned signature to the
  transaction, serialize it, and return the same string shape `signTransaction` returns today: one
  that `Transaction.from` parses and `broadcastTransaction` accepts unchanged.
- **ES-7** — THE SDK SHALL compute the address the signature recovers to from the digest and the
  signature alone (`ecrecover`, not a claim the signer makes), compare it case-insensitively to
  `signer.address`, and raise `ES_SIGNATURE_MISMATCH` if they differ, before returning anything.
  No signed transaction is ever returned to a caller signed by a key other than the one it asked
  for.
- **ES-14** — Before computing the signing digest, THE SDK SHALL verify `tx` carries `chainId`,
  `nonce`, `gasLimit`, and a complete fee specification — the fields ES-3 assumes a caller who used
  `prepareTransaction` already supplied. A fee specification is complete when **both**
  `maxFeePerGas` and `maxPriorityFeePerGas` are present, or when `gasPrice` is present and neither
  1559 field is. **One 1559 field without the other is incomplete even when `gasPrice` is also
  present**, because `inferType()` selects type 2 on the strength of the single 1559 field, ignores
  `gasPrice` entirely, and encodes the absent field as zero (measured — see T-2). IF the
  specification is incomplete, THEN THE SDK SHALL raise `ES_UNRESOLVED_TRANSACTION`, naming the
  missing field(s), and SHALL NOT call `signDigest`. _(Resolves OQ-3.)_
- **ES-15** — WHEN `tx` carries a `from` field — which `prepareTransaction`'s output always does —
  THE SDK SHALL validate it against `signer.address` and strip it before serializing, the same two
  steps `ethers.Wallet.signTransaction` performs internally (`assertArgument(getAddress(tx.from)
=== this.address)` then `delete tx.from`). `ethers.Transaction.from` rejects a transaction that
  defines `from`, so without this ES-3 cannot hold. IF `from` is present and does not
  case-insensitively equal `signer.address`, THEN THE SDK SHALL raise
  `ES_SIGNER_ADDRESS_MISMATCH` and SHALL NOT call `signDigest`. This is distinct from ES-7: it is
  detected **before** the signer is asked, and means "you asked for a transaction from an account
  this signer does not hold," not "the signer answered with the wrong key."

### Message signing

- **ES-8** — THE SDK SHALL apply the same EIP-191 personal-message prefix `signMessage` already
  applies (`ethers.hashMessage`), producing the message's digest, before passing it to
  `signDigest`. A signature produced this way SHALL verify identically to one `signMessage`
  would have produced with the corresponding private key, for the same message.
- **ES-9** — THE SDK SHALL apply ES-7's recovered-address check to `signMessageWithSigner` as
  well, under the same error code.

### Error propagation

- **ES-10** — IF `signDigest` rejects, THEN THE SDK SHALL propagate the rejection unchanged — not
  wrapped, not re-thrown as a different type, not stringified and re-parsed. A caller whose
  `signDigest` throws its own typed error (a classified NFC failure, a Secure Enclave
  authentication failure) SHALL be able to catch and inspect that exact error after it has passed
  through `signTransactionWithSigner` or `signMessageWithSigner`.
- **ES-11** — `ES_SIGNATURE_MISMATCH` SHALL be the SDK's own error, distinguishable from anything
  `signDigest` can throw, so a caller can tell "the signer answered, but with the wrong key" apart
  from "the signer failed to answer at all."

### Coexistence with private-key signing

- **ES-12** — THE SDK SHALL leave `signTransaction`, `signMessage` and `createWallet` unchanged.
  A caller with a private key today has no reason to change anything.
- **ES-13** — `signTransactionWithSigner` and `signMessageWithSigner` SHALL share their digest
  computation and serialization logic with `signTransaction`/`signMessage` rather than
  reimplementing it — one signing-digest computation per operation (transaction, message), two
  entry points into it (private key, external signer).

## Frontend contract

What the SDK guarantees to any consumer. No clause here constrains layout, copy, styling or
navigation. Verbatim from `keywalletmobileapp/specs/005-cryptnox-card-signing/plan.md` §SDK
contract required.

```ts
export type ExternalSigner = {
  address: string
  signDigest: (digest: string) => Promise<string>
}

export declare const signTransactionWithSigner: (
  signer: ExternalSigner,
  tx: TransactionRequest,
  rpcUrl?: string,
) => Promise<string>

export declare const signMessageWithSigner: (
  signer: ExternalSigner,
  message: string,
) => Promise<string>
```

- **FC-E1** — `signTransactionWithSigner` resolves chain id, nonce, gas and transaction type
  by the same rules as `signTransaction`, computes the type-correct signing digest, and returns
  a serialized signed transaction that `broadcastTransaction` accepts unchanged.
- **FC-E2** — It calls `signDigest` exactly once, with a `0x`-prefixed 32-byte hex digest, and
  passes nothing else that the signer must interpret.
- **FC-E3** — It accepts the returned signature as 65 bytes, `r ‖ s ‖ v`, with `v ∈ {27, 28}`,
  and performs the conversion to `yParity` for typed transactions itself.
- **FC-E4** — It rejects the signature if the address it recovers from the digest is not
  `signer.address`, and raises a distinguishable error rather than returning a transaction
  signed by an unexpected key.
- **FC-E5** — No path through either operation requires, derives or accepts a private key.
- **FC-E6** — Both operations propagate an error thrown by `signDigest` unchanged, so the app
  can classify a card failure by its own type rather than by string matching.
- **FC-E7** — `signMessageWithSigner` applies the same EIP-191 prefixing as `signMessage` and
  produces a signature that verifies identically.
- **FC-E8** — Every type, operation and error code this document names is importable from the
  package entry point and from nowhere else, as 001's FC-17 and 002's TFC-1 already require.
  _(New here — 005's plan.md did not need to state it because the mobile app's own CLAUDE.md
  already forbids a deep import regardless; it is stated here because this is the document that
  publishes the surface.)_

## Out of scope

- **Resolving chain id, nonce or gas from scratch.** `prepareTransaction` already exists and does
  this; `signTransactionWithSigner` accepts its output, same as `signTransaction` does today.
  Reimplementing that resolution a second time, keyed on which signing entry point was called,
  is exactly the duplication CLAUDE.md's "no reimplementation" rule forbids applied to this SDK's
  own code.
- **`signDigest`'s own implementation.** How a digest becomes a signature — an NFC tap, a Secure
  Enclave call, a Bluetooth round-trip — is entirely the caller's concern. This spec constrains
  only the shape `signDigest` must satisfy (ES-1) and what the SDK does with its result.
- **Retrying a failed `signDigest`.** ES-10 propagates the failure; whether and how to retry is a
  consumer decision, exactly as it already is for a broadcast failure.
- **A hardware-agnostic signer registry, or auto-detecting which signer an account needs.** The
  caller already knows which account it is signing for and which signer backs it; this spec adds
  one shape both can agree on, not a dispatch mechanism.
- **Batching multiple `signDigest` calls into one round-trip**, e.g. for an approval-then-swap
  pair. Each signing operation calls `signDigest` exactly once (FC-E2); a caller needing two
  signatures calls the relevant operation twice.

## Open questions

- **OQ-1** _(resolved)_ — Closed by direct measurement against ethers 6.16, without a chain: a
  `Wallet`-backed `ExternalSigner` (`signingKey.sign(digest).serialized` wrapped in ES-1's shape)
  was run through the plan's D-1 path and its output compared to `Wallet.signTransaction`'s for
  identical inputs. **Byte-identical in all three fee shapes** — 1559-only (type 2), `gasPrice`-only
  (type 1), and both-fee-fields (type 2, `prepareTransaction`'s actual output shape) — with the
  recovered address equal to the signer's in each. `signMessage` parity likewise byte-identical.
  This is stronger than the fork/testnet run originally asked for: byte equality subsumes "serializes
  and broadcasts identically," since a broadcast sees only those bytes.

  **The measurement corrected ES-4**, which is why it was worth running rather than reasoning
  through. ES-4 originally claimed `gasPrice`-only yields "legacy (type 0)". It does not:
  `inferTypes()` returns `[0, 1]` and `inferType()` takes `.pop()` → **1** (EIP-2930), serializing
  with a `0x01` type byte. `Wallet.signTransaction` produces exactly the same type 1 today, so this
  is a pre-existing property of the SDK that ES-4 merely described wrongly, not a regression this
  spec introduces. Type 0 is reachable only by setting `type: 0` explicitly. ES-4 now delegates to
  `inferType()` rather than restating the rule, so it cannot drift from ethers again.

  Note this is also why no chain run was needed for the legacy branch: every network in
  `NETWORKS_REGISTRY` is EIP-1559-capable and `prepareTransaction` always populates the type-2 fee
  fields, so type 1 and type 0 are unreachable in practice through the normal flow regardless.

- **OQ-2** _(resolved)_ — Confirmed, with the premise of the question corrected. `yParity = v - 27`
  is the right mapping (verified: `Signature.from` on a 65-byte `r ‖ s ‖ v` yields `v: 27`,
  `yParity: 0`, and `yParity === v - 27`). But **the SDK must not perform this conversion itself** —
  `ethers.Signature.from` already derives both `v` and `yParity` from the 65-byte input, and the
  serializer reads whichever the transaction type calls for. FC-E3's "performs the conversion to
  `yParity` itself" is satisfied by the SDK owning that step rather than pushing it onto the signer;
  it is not a licence to hand-compute `v - 27`, which would be exactly the reimplementation ES-4 and
  ES-13 forbid.

  The question's framing — conversion "only for EIP-1559, not legacy" — does not survive OQ-1's
  finding: a `gasPrice`-only transaction is type **1**, which is itself a typed transaction using
  `yParity`. Through the normal flow there is no reachable type-0 path at all. Since `Signature.from`
  covers every case uniformly, the distinction has no bearing on the implementation.

- **OQ-3** _(resolved)_ — Decision: fail fast, not fall-through. The fall-through behavior was
  measured rather than assumed: `Transaction.from({ to, value })` with nothing else resolved throws
  nothing and silently yields `chainId: 0n`, `nonce: 0`, `gasLimit: 0n`. Signing that digest would
  commit the signer to a transaction the caller never specified, with no private key on the
  caller's side to notice locally —
  the mistake would surface, if at all, only as a rejected broadcast downstream. **ES-14** now
  makes this an explicit guarantee: a `tx` missing `chainId`, `nonce`, `gasLimit`, or its fee
  fields raises `ES_UNRESOLVED_TRANSACTION` before `signDigest` is ever called. Not expected to
  trigger when a caller follows ES-3 and supplies `prepareTransaction`'s output, but the SDK
  should not depend on that being enforced by every caller.

## Retired identifiers

None. This is the first version of this spec.
