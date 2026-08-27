# 004 — Tasks

Execution order for [spec.md](./spec.md) under [plan.md](./plan.md). Every task cites the clauses
it satisfies and how it is verified.

**Verification legend** — `pure`: deterministic, invoked directly against a written expected value,
no chain. `chain`: executed on a low-cost mainnet with real funds, recording tx hashes and results.
`review`: satisfied by absence or by shape; confirmed by reading the diff.

**Status legend** — `[ ]` not started · `[~]` in progress · `[x]` done. A task earns `[x]` only once
its own verification has actually run (not merely written) and, per the standing rule below, its
public symbols resolve from `src/index.ts`. A task with public surface still unreachable from the
barrel stays `[~]` regardless of how complete its logic is.

Package manager is **yarn**. Format with `yarn prettier` and compile with `yarn build` before
closing any task.

**Standing rule (001 D-11, FC-17, CFC-18, and now FC-E8)** — a task that creates public surface
exports it from `src/index.ts` in the same change, in the existing explicit-barrel style. A task is
not closed while its public symbols are unreachable from the package entry point.

**Rule specific to this spec — two guarantees are satisfied by _absence_, and absence is what gets
broken by a well-meaning later edit.** ES-2/FC-E5 (no private key anywhere on the path) and
ES-10/FC-E6 (the signer's rejection propagates unwrapped) cannot be verified by exercising the happy
path, because a violation of either still produces a valid signed transaction. T-5 exists solely to
check them, and is not optional bookkeeping: D-4 names the exact well-intentioned edit — a
`catch` that rethrows "for a better error message" — that would silently break the consumer's ability
to classify a card failure by its own type.

**No test runner exists in this repo** (`package.json` has `build`, `prettier`, `prepublishOnly`
only). `pure` verification means a Node script run against the built `dist/`, as 001–003 did.

---

## Design-time measurements already taken

Recorded here so no task re-derives them, and so a task that _contradicts_ one is recognised as a
finding rather than a surprise. All measured against ethers 6.16, the pinned dependency, using the
D-1 sketch rather than the real functions — **the tasks below must reproduce them against the
shipped code**, since a sketch that works proves nothing about what actually gets written.

| Measured                                                                                      | Result                                                                      |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| D-1 path vs `Wallet.signTransaction`, 1559-only fee fields                                    | byte-identical, type 2                                                      |
| D-1 path vs `Wallet.signTransaction`, `gasPrice` only                                         | byte-identical, **type 1**, not type 0                                      |
| D-1 path vs `Wallet.signTransaction`, both fee shapes present (`prepareTransaction`'s output) | byte-identical, type 2                                                      |
| D-1 path vs `Wallet.signMessage`                                                              | byte-identical, recovers to the signer                                      |
| `Signature.from` on a 65-byte `r ‖ s ‖ v`                                                     | yields both `v: 27` and `yParity: 0`; `yParity === v - 27`                  |
| `Transaction.from({ to, value })`, nothing else resolved                                      | throws nothing; silently defaults `chainId: 0n`, `nonce: 0`, `gasLimit: 0n` |

The last row is the entire justification for ES-14. The second row corrected ES-4.

---

## Foundations

### [x] T-1 · `ExternalSigner`, `ExternalSignerError`, and the closed code set

**Files:** `src/types/externalSigner.ts` (new), `src/signing/ExternalSignerError.ts` (new), `src/index.ts`
**Satisfies:** ES-1, ES-11, FC-E8 · **Plan:** D-3, where this lives

`ExternalSigner` exactly as ES-1 and the §Frontend contract block declare it — `address: string`,
`signDigest: (digest: string) => Promise<string>`. No optional members, no `provider`, no
`getAddress()`; a wider type here is a wider thing every consumer must implement.

`ExternalSignerError` mirrors [SwapError.ts](../../src/swap/SwapError.ts) line for line — `code`,
`message`, `details`, plus an `isExternalSignerError` guard. **Not a subclass of `SwapError` and not
a shared base class** (D-3): `isSwapError(e)` must stay `false` for an `ExternalSignerError` and
vice versa, so a consumer's `catch` cannot narrow onto the wrong one. The four-line duplication is
deliberate.

`ExternalSignerErrorCode` is a closed set of two: `'ES_SIGNATURE_MISMATCH'`,
`'ES_UNRESOLVED_TRANSACTION'`. Both are raised by later tasks; both are declared here so the set is
defined in one place.

`ExternalSignerErrorCode` lives in `ExternalSignerError.ts`, not in `types/`. This **departs from
where `SwapErrorCode` sits** (`types/swap.ts`, imported by `SwapError.ts`) and follows T-6's export
table instead: the closed set sits next to the only class that raises it. Recorded rather than left
to be discovered as an inconsistency later.

**Verify** `pure` — **18/18 assertions passed.** The exhaustive `switch` over
`ExternalSignerErrorCode` with no `default` compiled clean under `tsc -p tsconfig.json --noEmit
--strict`, in a scratch file inside `src/` (an out-of-tree file could not resolve the barrel
import), then deleted. Exhaustiveness is confirmed _by the compiler's silence in a run where the
same check was observed failing_: an earlier broken run raised `TS2366 Function lacks ending return
statement`, so the clean run proves TS narrowed the union to nothing, not that the check was inert.
Both `@ts-expect-error` directives were consumed — no `TS2578 Unused directive` — confirming a third
code literal is rejected **and** that an object carrying a `privateKey` member is not assignable to
`ExternalSigner` (ES-2 at the type level).
Runtime, against the built `dist/cjs`: the D-3 cross-guard holds in all four directions —
`isExternalSignerError(swapError)` and `isSwapError(externalSignerError)` are both `false`, and
neither class is `instanceof` the other. Shape mirrors `SwapError`: `instanceof Error`, `name`,
`code`, `message`, `details`, `details` optional when omitted, and the instance survives
`throw`/`catch` identity. The guard returns `false` for `null`, `undefined`, a bare code string, a
duck-typed `{ code }` object, and a plain `Error`.
`review` — imported **from outside the repo tree** (a `node -e` run from the scratch directory, as
001's T-12 established): `ExternalSignerError` and `isExternalSignerError` resolve as functions from
the bare entry point. All four symbols present in both `dist/index.d.ts` and `dist/cjs/index.d.ts`;
`dist/types/externalSigner.d.ts` and `ExternalSignerErrorCode` both emitted.
**Depends on:** —

---

## Signing operations

### [x] T-2 · `signTransactionWithSigner`

**Files:** `src/services/evm-wallet-core/externalSigner.ts` (new), `src/index.ts`
**Satisfies:** ES-3, ES-4, ES-5, ES-6, ES-7, ES-10, ES-14, FC-E1, FC-E2, FC-E3, FC-E4 · **Plan:** D-1, D-2, D-4

D-1's four lines, in order: `Transaction.from(tx)` → `keccak256(unsignedSerialized)` →
`await signer.signDigest(digest)` → `signature = Signature.from(sig)` → return `serialized`. A
function, not a class; no `AbstractSigner`, no `connect`, no `populateTransaction` (D-1).

**Three things this task must get right, each of which looks like a detail and is not:**

1. **The ES-14 guard runs first, before `Transaction.from`.** Check `chainId`, `nonce`, `gasLimit`,
   and a complete fee specification (see the finding below — a partial 1559 pair does not become
   complete because `gasPrice` is also set); raise
   `ES_UNRESOLVED_TRANSACTION` naming the missing field(s). It must come first because
   `Transaction.from` does not throw on an under-resolved input — it defaults silently (see the
   measurement table), so after that call the information needed to detect the problem is gone.
2. **`signDigest` is called exactly once (FC-E2), and never inside a `try`** (D-4, ES-10). `await`
   alone propagates the rejection unchanged. Do not add a `catch` that rethrows, not even to attach
   context — that is precisely what turns a consumer's typed `CryptnoxCardError` into an
   unnarrowable plain `Error`.
3. **Do not compute `v - 27` anywhere.** `Signature.from` derives `v` and `yParity` both, and the
   serializer reads whichever the inferred type needs. FC-E3 is satisfied by owning that step, not
   by hand-rolling the arithmetic (OQ-2).

The recovered-address check (ES-7) reads `Transaction.from(serialized).from` — re-parsing the
**serialized output**, so the round trip is verified, not just the digest that was signed — and
compares it to `signer.address`. Normalization goes through the SDK's existing
`normalizeEvmAddress` (`utils/normalizeAddress.ts`) rather than a bare `getAddress` as D-2 sketched:
it already lowercases and returns `null` instead of throwing, so a malformed `signer.address` lands
on `ES_SIGNATURE_MISMATCH` rather than escaping as an untyped ethers `INVALID_ARGUMENT`. Reuse, per
the plan's no-reimplementation rule. It runs **before returning**, never after.

Type is never set by this SDK — `inferType()` decides (ES-4).

**One finding, and it changed ES-14's wording.** The clause as originally written ("either both
1559 fields or `gasPrice`") has a hole: `maxFeePerGas` + `gasPrice` with **no**
`maxPriorityFeePerGas` satisfies it literally, but `inferType()` selects **type 2** on the strength
of the single 1559 field, ignores `gasPrice` completely, and serializes with `maxPriorityFeePerGas`
encoded as zero — measured directly. That is precisely the silent default ES-14 exists to prevent,
so the implemented rule is stricter than the literal clause: **one 1559 field without the other is
incomplete regardless of `gasPrice`.** ES-14 has been reworded to say so; the code and the clause
agree.

**Verify** `pure` — **29/29 assertions passed**, run from outside the repo tree against the built
`dist/cjs` (which doubles as the FC-E8 barrel check).
Byte equality against `signTransaction` — the same private key, the same tx — holds for all three
fee shapes: 1559-only, `gasPrice`-only, and both-present (`prepareTransaction`'s actual output).
Byte equality is the assertion, not "parses to the same fields": a broadcast sees only the bytes.
Serialized types confirmed **2 / 1 / 2** against shipped code, so ES-4's rewording is verified here
and not inherited from the design-time note. `Transaction.from(mine).from` equals the signer in all
three.
ES-14: eight cases — missing `chainId`, `nonce`, `gasLimit`; fees entirely absent; `maxFeePerGas`
without `maxPriorityFeePerGas`; and the hole above (`maxFeePerGas` + `gasPrice`, no
`maxPriorityFeePerGas`) — each raising `ES_UNRESOLVED_TRANSACTION` with the missing field named in
`details.missing`, and **`signDigest`'s call counter asserted `0`** every time. A guard that fires
after the card has been tapped is worthless, so the counter is the real assertion.
ES-7: a signer whose `address` is a second wallet's, answering with a genuinely valid signature, →
`ES_SIGNATURE_MISMATCH`, not narrowable as a `SwapError`, counter at `1` (the signer _did_ answer —
this is the case ES-11 exists to distinguish). Accepted without spurious mismatch: checksummed,
all-lowercase, `0x`+all-uppercase, and whitespace-padded addresses. Rejected as
`ES_SIGNATURE_MISMATCH` rather than as an untyped throw: `'bad'`, `''`, `'0x123'`, `null`,
`undefined`.
ES-10: a `signDigest` rejecting with a `CryptnoxCardError`-shaped class — the caught value is
asserted to be the **same instance** (`e === boom`), `instanceof` that exact class, `.code` intact,
and **not** an `ExternalSignerError`. Identity, not just "something threw".
FC-E2: counter exactly `1` on every happy path, and every digest passed matches `/^0x[0-9a-f]{64}$/`.
**Depends on:** T-1

### [ ] T-3 · `signMessageWithSigner`

**Files:** `src/services/evm-wallet-core/externalSigner.ts`, `src/index.ts`
**Satisfies:** ES-8, ES-9, ES-10, FC-E2, FC-E7 · **Plan:** D-1, D-2, D-4

`hashMessage(message)` → `signDigest` → `Signature.from(sig).serialized`. The EIP-191 prefixing is
`ethers.hashMessage`, the same call `Wallet.signMessage` makes internally — not a hand-written
`"\x19Ethereum Signed Message:\n"` concatenation (ES-13).

ES-9 applies ES-7's check here too, under the same code, but recovery goes through
`verifyMessage(message, signature)` rather than `Transaction.from` (D-2). Same normalization, same
"before returning" ordering, same no-`try`-around-`signDigest` rule as T-2.

**Verify** `pure` — byte equality against `w.signMessage(message)` for the same message and key
(FC-E7 — "verifies identically" is asserted as byte-identical output, which is strictly stronger).
Cases: ASCII, empty string, a multi-byte UTF-8 string (so the prefix's byte-length rather than
character-length is exercised), and a `0x`-prefixed string that must be treated as **text**, not as
bytes — the case a hand-rolled prefix implementation gets wrong. Mismatch and propagation cases as
in T-2, plus the `signDigest` call counter at exactly `1`.
**Depends on:** T-1

---

## Audits

### [ ] T-4 · Prove the private-key path is untouched

**Files:** none (audit)
**Satisfies:** ES-12, ES-13 · **Plan:** D-1

ES-12 is a claim about a **diff**, so it is verified as one, the way 003's T-5 handled its
equivalent. `git diff main -- src/services/evm-wallet-core/signer.ts` must be **empty**, confirmed
by exit code and zero output lines rather than eyeballed. `createWallet`, `signMessage` and
`signTransaction` keep byte-identical declarations in the built `dist/`.

ES-13's "share rather than reimplement" is checked here too, and it is a judgement call worth
writing down explicitly rather than waving at: the shared thing is **ethers' own** digest
computation (`Transaction.unsignedSerialized` + `keccak256`, `hashMessage`), which both entry points
call. `signTransaction` does not gain a refactor to route through the new code — extracting a shared
private helper out of `Wallet.signTransaction` is impossible anyway, since that path is inside
ethers. What ES-13 forbids is the new file hand-rolling a _second_ digest computation; that it does
not is what gets confirmed.

**Verify** `review` — the `signer.ts` diff is empty by exit code. `grep -nE "0x19|Ethereum Signed
Message|serializeTransaction|rlp|RLP" src/services/evm-wallet-core/externalSigner.ts` returns
nothing — no hand-rolled prefixing, no hand-rolled encoding. The only hashing call in the new file
is `keccak256(...unsignedSerialized)` and the only message-digest call is `hashMessage`.
**Depends on:** T-2, T-3

### [ ] T-5 · Prove no private key and no error wrapping

**Files:** none (audit)
**Satisfies:** ES-2, ES-10, FC-E5, FC-E6 · **Plan:** D-4

The two guarantees satisfied by absence (see the spec-specific rule at the top). A violation of
either still produces a correctly signed transaction, so no happy-path test can catch them.

- **ES-2 / FC-E5** — no `privateKey`, `Wallet`, `SigningKey`, `Mnemonic`, `HDNodeWallet` or
  `createWallet` reference anywhere on the path from either entry point to `signDigest`. Not "no
  private key is used" — **no private key is accepted, derived or constructible**, including via an
  optional parameter someone might add later.
- **ES-10 / FC-E6** — no `try`/`catch` surrounding the `signDigest` call, and no `throw` in the new
  file other than the two `ExternalSignerError` raises.

**Verify** `review` — `grep -nE "privateKey|new Wallet|SigningKey|Mnemonic|HDNodeWallet|createWallet"`
against `src/services/evm-wallet-core/externalSigner.ts` returns nothing; the file's ethers import
line is inspected directly and contains none of them. `grep -nE "try|catch"` returns nothing.
`grep -nE "throw " ` returns exactly two hits, both `ExternalSignerError`.
`pure` — the empirical half, since grep only proves the current text: a signer whose `signDigest`
rejects is confirmed (as in T-2, re-asserted here as the clause's own check) to surface the original
class instance, and the `ExternalSigner` object passed in is asserted to still have exactly two own
properties afterwards — nothing was read off it or attached to it.
**Depends on:** T-2, T-3

### [ ] T-6 · Audit the public export surface

**File:** `src/index.ts`
**Satisfies:** FC-E8 · **Plan:** where this lives

Each preceding task exported its own symbols under the standing rule; this confirms the result is
complete and contains nothing more.

| Must be exported                                                          | From                                      |
| ------------------------------------------------------------------------- | ----------------------------------------- |
| `signTransactionWithSigner`, `signMessageWithSigner`                      | `services/evm-wallet-core/externalSigner` |
| `ExternalSigner`                                                          | `types/externalSigner`                    |
| `ExternalSignerError`, `isExternalSignerError`, `ExternalSignerErrorCode` | `signing/ExternalSignerError`             |

FC-E8 says "importable from the package entry point **and from nowhere else**" — the consumer's own
CLAUDE.md forbids deep imports, so the check is that the barrel is sufficient, not that deep paths
are physically blocked.

**Verify** `review` — the six symbols cross-checked against `src/index.ts` and the built
`dist/index.d.ts`. Then, as 001's T-12 and 003's T-6 did, **import the built package from outside
the repo tree** — a `node -e` run from the scratch directory, not this one — exactly as a consumer
would, confirming all six resolve from the bare entry point. `grep -n "export \*" src/index.ts`
returns nothing (the barrel stays explicit).
**Depends on:** T-4, T-5

---

## Integration

### [ ] T-7 · Document the public surface

**File:** `README.md`
**Satisfies:** FC-E1 – FC-E8 · **Plan:** where this lives

A new "External signers" subsection under the existing signing documentation, not a separate
top-level section — a consumer reading about signing must not have to discover that the
hardware-backed path is documented elsewhere. Must state explicitly, because none of it is inferable
from the signatures:

- **FC-E2 / ES-1** — what `signDigest` receives (a `0x`-prefixed 32-byte digest, nothing else) and
  what it must return (65 bytes, `r ‖ s ‖ v`, `v ∈ {27, 28}`). This is the whole contract an
  integrator implements against
- **FC-E6** — the signer's own error propagates unwrapped, so classify by type, never by string
  matching
- **FC-E4** — `ES_SIGNATURE_MISMATCH` means "the signer answered with the wrong key," distinct from
  "the signer failed"; catch with `isExternalSignerError`, not `isSwapError`
- **ES-14** — `signTransactionWithSigner` requires `prepareTransaction`'s output and raises
  `ES_UNRESOLVED_TRANSACTION` rather than silently defaulting; show the two called in sequence
- **ES-12** — the private-key operations are unchanged; an existing consumer needs no edit

Signatures pulled from the built `dist/*.d.ts`, never from plan.md — the plan is a design-time
artifact and may have drifted from what shipped, the discipline 001's T-14 established after finding
exactly that. An HTML comment citing the clause ids sits at the top of the new subsection, per
CLAUDE.md's traceability exception.

**Verify** `review` — every signature in the section diffed against the corresponding `dist/*.d.ts`.
Each of the five call-outs confirmed present by an individual grep. `yarn prettier --check README.md`
and `yarn build` both clean.
**Depends on:** T-6

### [ ] T-8 · On-chain verification run

**Files:** none (records land in this file)
**Satisfies:** ES-3, ES-6, ES-7, ES-14, FC-E1, FC-E4 end to end
**Plan:** verification

T-2's byte-equality check is strictly stronger than a broadcast for the _signing_ half — but it says
nothing about whether a node accepts the result, which is the claim FC-E1 actually makes
("`broadcastTransaction` accepts unchanged"). One real transaction settles that.

Run from the `wallet-broadcasting` test repo against a symlinked build, as 001–003 did. Scenarios:

| #   | Scenario                                                                                                                         | Cost |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `prepareTransaction` → `signTransactionWithSigner` (Wallet-backed) → `broadcastTransaction`, native transfer on a low-cost chain | gas  |
| 2   | the same prepared tx signed both ways, bytes compared before either is broadcast                                                 | none |
| 3   | `signMessageWithSigner` → `verifyMessage` recovers the signer's address                                                          | none |
| 4   | a hand-built `tx` missing `chainId` → `ES_UNRESOLVED_TRANSACTION`, nothing broadcast                                             | none |
| 5   | signer whose `address` is a different wallet → `ES_SIGNATURE_MISMATCH`, nothing broadcast                                        | none |

Only scenario 1 spends. Record the real tx hash, the chain, and the inferred type.

**Note for whoever runs this:** every chain in `NETWORKS_REGISTRY` is EIP-1559-capable and
`prepareTransaction` always populates the type-2 fee fields, so scenario 1 exercises **type 2 only**.
Type 1 and type 0 are unreachable through the normal flow (OQ-1) and are covered by T-2's `pure`
check alone. Do not hand-craft a `gasPrice`-only transaction here just to reach type 1 — it would be
a transaction no consumer of this SDK can actually produce.

**Verify** `chain` — scenario 1 confirmed by a real hash reaching `success` via `txStatus`, with the
recovered `from` equal to the signer's address on the mined transaction. Scenarios 2–5 recorded with
their results in this file, in 003's T-8 format.
**Depends on:** T-6

### [ ] T-9 · Release 1.10.0

**File:** `package.json`
**Satisfies:** — · **Plan:** depends on

Bump `1.9.0` → `1.10.0`. **Minor, and additive only** — unlike 003, nothing here is a compile break:
ES-12 guarantees the existing signing surface is untouched, and every new symbol is new. A consumer
on 1.9.0 upgrades with no edit.

Release note names the new surface and the `keywalletmobileapp` 005 T-1 dependency this unblocks.
Published manually by the user, per their standing preference.

**Verify** `review` — the published tarball (`npm pack @octaflowlabs/onchain-sdk@1.10.0`, extracted,
not assumed from the local build) confirmed directly: all six symbols present in both
`dist/index.d.ts` and `dist/cjs/index.d.ts`; `package.json` inside the tarball reads `1.10.0`.
**Check the `latest` dist-tag explicitly** — it lagged in both 001 (T-16) and 003 (T-9), and an
unpinned `yarn add` would otherwise install neither this release nor 1.9.0.
**Depends on:** T-7, T-8

---

## Clause coverage

Every clause in spec.md maps to at least one task.

| Clause     | Task                                                   |
| ---------- | ------------------------------------------------------ |
| ES-1       | T-1, T-7                                               |
| ES-2       | T-5                                                    |
| ES-3       | T-2, T-8                                               |
| ES-4       | T-2                                                    |
| ES-5, ES-6 | T-2, T-8                                               |
| ES-7       | T-2, T-8                                               |
| ES-8       | T-3                                                    |
| ES-9       | T-3                                                    |
| ES-10      | T-2, T-3, T-5                                          |
| ES-11      | T-1, T-7                                               |
| ES-12      | T-4, T-9                                               |
| ES-13      | T-3, T-4                                               |
| ES-14      | T-2, T-7, T-8                                          |
| FC-E1      | T-2, T-7, T-8                                          |
| FC-E2      | T-2, T-3, T-7                                          |
| FC-E3      | T-2                                                    |
| FC-E4      | T-2, T-7, T-8                                          |
| FC-E5      | T-5                                                    |
| FC-E6      | T-5, T-7                                               |
| FC-E7      | T-3, T-7                                               |
| FC-E8      | every task that creates public surface; audited by T-6 |

**Frontend repo** — `keywalletmobileapp` spec 005's T-1 is blocked on this shipping and references
these clauses by id. Nothing in this spec is duplicated there; the `FC-E1` – `FC-E7` wording
originated in that repo's plan.md and must stay identical in both.
