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

`ExternalSignerErrorCode` is a closed set of three: `'ES_SIGNATURE_MISMATCH'`,
`'ES_UNRESOLVED_TRANSACTION'`, `'ES_SIGNER_ADDRESS_MISMATCH'`. All are raised by later tasks; all
are declared here so the set is defined in one place. _(The third was added during T-8, when the
`from`-field defect below forced clause ES-15 — the set was two when this task first closed.)_

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

**A defect this task's own verification missed, caught by T-8 — the most important entry in this
file.** Every fixture here hand-built its `tx`. `prepareTransaction` **always sets `from`**
([prepareTransaction.ts:30](../../src/blockchain/prepareTransaction.ts#L30)), and
`ethers.Transaction.from` throws `unsigned transaction cannot define '.from'` when it is present.
So `signTransactionWithSigner` was **incapable of signing a real `prepareTransaction` output** —
the exact input ES-3 promises to accept — while passing 29/29 locally. The first line of the T-8
harness that used the real function together with the real preparer failed immediately.

`ethers.Wallet.signTransaction` handles this in two steps this implementation had not mirrored
([base-wallet.js:67-70](../../node_modules/ethers/lib.commonjs/wallet/base-wallet.js#L67-L70)):
assert `getAddress(tx.from) === this.address`, then `delete tx.from`. Since FC-E1 says "by the same
rules as `signTransaction`", mirroring both steps is required by the existing contract, not an
addition to it. The typed error for the assert half had no code in the closed set, so clause
**ES-15** and `ES_SIGNER_ADDRESS_MISMATCH` were added — the same pattern ES-14 followed.
The lesson is the one this file already states in its own header and failed to apply: a fixture
that constructs its input by hand cannot verify a clause whose subject is _another function's
output_. Fixtures now cover `from`, but T-8 is what actually proves ES-3.

**Verify** `pure` — **36/36 assertions passed**, run from outside the repo tree against the built
`dist/cjs` (which doubles as the FC-E8 barrel check). Seven of the 36 are the ES-15 cases added
after the defect: `from` matching the signer is accepted and produces output identical to the same
tx without `from`; a lowercased `from` is accepted; a different wallet's address, `'nope'` and `''`
each raise `ES_SIGNER_ADDRESS_MISMATCH` with the signer's call counter at `0`; and the caller's `tx`
object is confirmed not mutated (the strip is done on a copy).
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

### [x] T-3 · `signMessageWithSigner`

**Files:** `src/services/evm-wallet-core/externalSigner.ts`, `src/index.ts`
**Satisfies:** ES-8, ES-9, ES-10, FC-E2, FC-E7 · **Plan:** D-1, D-2, D-4

`hashMessage(message)` → `signDigest` → `Signature.from(sig).serialized`. The EIP-191 prefixing is
`ethers.hashMessage`, the same call `Wallet.signMessage` makes internally — not a hand-written
`"\x19Ethereum Signed Message:\n"` concatenation (ES-13).

ES-9 applies ES-7's check here too, under the same code, but recovery goes through
`verifyMessage(message, signature)` rather than `Transaction.from` (D-2). Same normalization, same
"before returning" ordering, same no-`try`-around-`signDigest` rule as T-2.

Both operations live in one file and share `assertRecoveredAddress`, which stays **module-private**
— T-3 needed no new export for it, and widening the surface for a helper the spec never names would
work against FC-E8.

**Verify** `pure` — **44/44 assertions passed**, run from outside the repo tree against the built
`dist/cjs`.
Byte equality against `signMessage` for the same key holds across six message shapes: ASCII, empty
string, multi-byte UTF-8 (`héllo — 世界 🚀`), a `0x`-prefixed 32-byte hex string, control characters
(newline, CR, tab), and a 2KB message. For each, the recovered address equals the signer, the
`signDigest` counter is exactly `1`, and **the digest passed is asserted equal to `hashMessage(m)`**
— not merely well-formed, so ES-8 is checked against ethers' own value rather than against a
plausible-looking 32 bytes.
The two cases a hand-rolled prefix gets wrong are asserted directly: the `0x`-prefixed string is
hashed as **text** (its digest differs from that of the same value hex-decoded to bytes) and is the
one our code passes; and `hashMessage('é') !== hashMessage('e')`, confirming the prefix counts
**bytes**, not characters.
ES-9: a second wallet's `address` → `ES_SIGNATURE_MISMATCH`, not narrowable as `SwapError`, counter
at `1`. Accepted: checksummed, all-lowercase, `0x`+all-uppercase. Rejected as
`ES_SIGNATURE_MISMATCH` rather than as an untyped throw: `'bad'`, `''`, `null`, `undefined`.
ES-10: a `CryptnoxCardError`-shaped rejection comes back as the same instance with `.code` intact
and is not an `ExternalSignerError`.
`review` — T-2's 29 assertions re-run green after this change (no regression). ES-13 confirmed by
grep over the code (comments excluded): **no** `try`/`catch`, no `0x19`/`Ethereum Signed
Message`/`toUtf8Bytes` concatenation, no `v - 27`, no key material; exactly two digest computations
in the file (`keccak256(unsignedSerialized)`, `hashMessage`) and exactly two `signDigest` call
sites, one per operation. Both operations resolve from the bare entry point;
`assertRecoveredAddress` is `undefined` on the barrel.
**Depends on:** T-1

---

## Audits

### [x] T-4 · Prove the private-key path is untouched

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

**Note on the diff base.** By the time this ran, the work had been committed to a branch
(`feat/external-signer`, four commits) rather than sitting uncommitted on `main`, so
`git diff main...HEAD` is a real branch-vs-main comparison. That is a **stronger** base than 003's
T-5 had — that task found `main` lagging at 1.7.0 and had to fall back to the published tarball to
prove anything. Both bases were used here anyway.

**Verify** `review` — **ES-12 confirmed at three levels, all clean.**
Source: `git diff main...HEAD -- src/services/evm-wallet-core/signer.ts` is empty by exit code (0
lines). The feature's entire source footprint is three new files plus `src/index.ts`; the barrel's
diff is **purely additive** — 14 added lines, zero removed, confirmed by grepping the diff for `-`
lines and finding none.
Built declarations: `createWallet`, `signMessage` and `signTransaction` keep their exact signatures
in `dist/services/evm-wallet-core/signer.d.ts`.
Published package: `npm pack @octaflowlabs/onchain-sdk@1.9.0`, extracted, and `signer.d.ts` and
`signer.js` both **byte-identical** to this branch's build — not assumed from the local build, per
003's T-5 discipline. Across the whole 180-file `dist` tree, exactly **4** pre-existing files
differ, and all four are the barrel (`index.js`/`index.d.ts` in both ESM and CJS). Everything else
this feature adds is new; **nothing was removed** (no file present in the published tarball is
missing from this build).
ES-13: with block comments stripped, `grep -nE "0x19|Ethereum Signed Message|serializeTransaction|
rlp|RLP|toUtf8Bytes|concat"` over the new file returns nothing — no hand-rolled prefixing, no
hand-rolled encoding. The file contains exactly two digest computations,
`keccak256(populated.unsignedSerialized)` and `hashMessage(message)`, one per operation, and exactly
two `signDigest` call sites.
**Depends on:** T-2, T-3

### [x] T-5 · Prove no private key and no error wrapping

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

**Verify** `review` — every grep run over the file with **block comments stripped first**, since the
traceability header legitimately contains the words `private key` and `try/catch` and would
otherwise produce false hits that hide a real one.
`privateKey|private key|new Wallet|Wallet(|SigningKey|Mnemonic|HDNode|createWallet|mnemonic|seed|
entropy` → **none**. `try|catch|finally|.catch(` → **none**. `throw ` → exactly **two**, both
`new ExternalSignerError(`. The ethers import line read directly:
`{ Transaction, Signature, keccak256, hashMessage, verifyMessage }` — nothing key-bearing.
Extended beyond the task's original scope to the **transitive** path, since ES-2 says "anywhere on
the path": the same grep over `utils/normalizeAddress.ts`, `signing/ExternalSignerError.ts`,
`types/externalSigner.ts` and `types/common.ts` returns 0 hits each.

`pure` — **29/29 assertions passed.** Grep only proves the current text, so the empirical half was
made stronger than written: the signer is passed in wrapped in a **`Proxy` that records every
property read off it**, with decoy `privateKey` and `_secret` members present on the target. Both
operations read exactly `["address", "signDigest"]` and nothing else — this catches a
`signer.privateKey` probe that no grep of _this_ repo would see, because the read would happen here
against an object the caller owns. Neither operation mutates the signer.
A signer with no key material at all completes both operations, and still has exactly two own
properties afterwards (nothing attached).
Rejection identity asserted for **both** operations, not just the transaction one: same instance
(`e === boom`), `instanceof` the original class, `.code` intact, `.stack` not rewritten, and not an
`ExternalSignerError`. Also confirmed for **non-`Error` rejections** — a string, a plain object, a
number and `null` each come back via `Object.is`, so nothing is coerced or wrapped on the way out.
**Depends on:** T-2, T-3

### [x] T-6 · Audit the public export surface

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

**No edits were needed**, as in 001's T-12 and 003's T-6: T-1, T-2 and T-3 each exported their own
symbols under the standing rule, so this task is a confirmation, not a batch of fixes. `src/index.ts`
carries no JSDoc traceability header of its own — it never has, in 001, 002 or 003 — so there is
none to add here; the convention puts the block on the file that _defines_ a symbol, not the one
that re-exports it.

**Verify** `review` — **25/25 assertions passed**, run from outside the repo tree, resolving the
package through its own `package.json` `main` rather than a hand-written path, exactly as a
consumer's resolver would. All four runtime values (`signTransactionWithSigner`,
`signMessageWithSigner`, `ExternalSignerError`, `isExternalSignerError`) are functions off the bare
entry point, and both operations round-trip a real signature through it. All six symbols are
declared in **both** `dist/index.d.ts` and `dist/cjs/index.d.ts`, and all four value exports appear
in the ESM half too. `grep "export \*"` and `grep "internal/"` over `src/index.ts` both return
nothing — the barrel stays explicit. `assertRecoveredAddress`, `assertResolvedTransaction` and
`isPresent` are `undefined` on the barrel: the module-private helpers stayed private.

**One finding, pre-existing, out of scope, and narrower than it first looked.** The ESM build emits
**extensionless relative imports** (`import ... from './ABIs/ERC20_TOKEN_CONTRACT_ABI'`), which
Node's native ESM resolver rejects with `ERR_MODULE_NOT_FOUND`. Verified **not** caused by this
feature: the extracted `1.9.0` tarball has byte-identical extensionless imports.

**It does not affect normal consumption, and an earlier draft of this note wrongly said it did.**
`package.json` has no `exports` map, so Node resolves a bare `import '@octaflowlabs/onchain-sdk'`
through `main` — the **CJS** build — and imports it fine from an ESM caller via named-export
detection. Confirmed directly from an ESM package with the SDK symlinked: all three checked symbols
resolve. Node ignores the `module` field entirely. The failure only occurs on a **deep path**
(`import '.../dist/index.js'`), which FC-E8 forbids anyway and which is what the probe that surfaced
this was doing. Bundlers that do honour `module` (Metro, webpack, Vite) resolve extensionless
specifiers themselves. Worth fixing eventually via `.js` extensions or an `exports` map; not urgent,
and not 004's.
**Depends on:** T-4, T-5

---

## Integration

### [x] T-7 · Document the public surface

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

Placed as a `####` subsection **inside** `### Wallet and signing`, immediately after that section's
table, rather than as a sibling `###` — a consumer reading about signing meets the hardware-backed
path in the same place as the private-key one, which is the point.

**Verify** `review` — all three signatures (`signTransactionWithSigner`, `signMessageWithSigner`,
`isExternalSignerError`) matched **character-for-character** against
`dist/services/evm-wallet-core/externalSigner.d.ts` and `dist/signing/ExternalSignerError.d.ts`, not
against plan.md. Seven call-outs confirmed present by individual grep — the five the task required
plus FC-E2's "exactly once" and FC-E3's `yParity` ownership. Traceability comment sits above the
subsection. `yarn prettier --check README.md` and `yarn build` both clean.

**The documented examples are compiled, not just read.** Both code blocks were extracted into a
scratch `.ts` inside `src/`, imported through the barrel exactly as written, and type-checked under
`tsc -p tsconfig.json --noEmit --strict` — clean, then deleted. This caught nothing this time, but
it is the only way to know a README example is real: the `prepareTransaction({ rpcUrl, chainId, tx,
fromAddress })` → `{ unsignedTx }` → `signTransactionWithSigner` → `broadcastTransaction({ rpcUrl,
signedTx })` chain is confirmed to typecheck against the shipped declarations, parameter shapes
included. A prose-only check would have accepted a wrong destructuring silently.
**Depends on:** T-6

### [x] T-8 · On-chain verification run

**Files:** none (records land in this file)
**Satisfies:** ES-3, ES-6, ES-7, ES-14, FC-E1, FC-E4 end to end
**Plan:** verification

T-2's byte-equality check is strictly stronger than a broadcast for the _signing_ half — but it says
nothing about whether a node accepts the result, which is the claim FC-E1 actually makes
("`broadcastTransaction` accepts unchanged"). One real transaction settles that.

Run from the `wallet-broadcasting` test repo against a symlinked build, as 001–003 did. Scenarios:

| #   | Scenario                                                                                                                         | Cost | Result                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| 1   | `prepareTransaction` → `signTransactionWithSigner` (Wallet-backed) → `broadcastTransaction`, native transfer on a low-cost chain | gas  | **passed** — Polygon, block 92776153, type 2, `success` at t+3s  |
| 2   | the same prepared tx signed both ways, bytes compared before either is broadcast                                                 | none | **passed** — byte-identical, type 2, one `signDigest` call       |
| 3   | `signMessageWithSigner` → `verifyMessage` recovers the signer's address                                                          | none | **passed** — recovers to signer, byte-identical to `signMessage` |
| 4   | a `tx` missing `chainId` → `ES_UNRESOLVED_TRANSACTION`, nothing broadcast                                                        | none | **passed** — `details.missing: ["chainId"]`, counter `0`         |
| 5   | signature recovers to a different address → `ES_SIGNATURE_MISMATCH`, nothing broadcast                                           | none | **passed** — counter `1` (the signer answered)                   |
| 6   | `tx.from` disagrees with `signer.address` → `ES_SIGNER_ADDRESS_MISMATCH`                                                         | none | **passed** — counter `0` (caught before tapping)                 |
| 7   | `prepareTransaction`'s output signed unmodified, `from` and all                                                                  | none | **passed** — the regression case for the ES-15 defect            |

Only scenario 1 spends. Record the real tx hash, the chain, and the inferred type.

**Scenario 1, the only claim no local test can make — FC-E1's "`broadcastTransaction` accepts
unchanged" — is now confirmed on Polygon mainnet:**

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| tx hash        | `0xbd161d54c133208da41dccfc8f87bd192e31eff1da74050f516e2c4adb68b1f3` |
| chain / block  | 137 / 92776153                                                       |
| type           | **2** (EIP-1559), as ES-4 predicts for `prepareTransaction`'s output |
| from / nonce   | `0x869B99a2E06B108E993e6e54876a81e5D0291c10` / 0                     |
| gas used / fee | 21000 / 0.006312128765229 POL                                        |
| settled        | `success` at t+3s, first poll                                        |

**Verified from a different RPC than the one that broadcast it** (`polygon.publicnode.com`, against
a broadcast through `poly.api.pocket.network`), so the confirmation does not depend on the node that
accepted it: receipt `status: 1`, `tx.from` equal to the signer's address, `tx.type: 2`, sender nonce
advanced 0 → 1. **A node accepted bytes produced by a signer that never held a private key** — every
other check in this spec is local and could not have established that.

**Two infrastructure notes from the run, neither a code defect.** The first attempt failed at
`broadcastTransaction` with HTTP 429 `rate limit exceeded` from `polygon.gateway.tenderly.co`; the
signing half had already completed correctly (one `signDigest` call, type 2, recovered address
matching). Confirmed nothing was spent before retrying — sender nonce still `0`, balance unchanged,
tx hash absent from chain — then re-ran against a different RPC. Retrying was safe regardless: the
signed bytes for a given nonce are deterministic, so a re-broadcast either lands the same hash or is
rejected as already known. Separately, `wallet-broadcasting`'s `settings.ts` falls back to a
**Sepolia** URL for chain `137` when `RPC_URL_POLYGON` is unset — harmless here since the variable
was set, but it would silently prepare against the wrong network.

**Scenarios 5 and 6 had to be split, and the reason is worth recording.** Scenario 5 as originally
written used `prepareTransaction`'s output unmodified with an impostor `signer.address` — which now
raises `ES_SIGNER_ADDRESS_MISMATCH` at the ES-15 guard, **before** `signDigest`, so ES-7 was never
reached and the scenario silently stopped testing what it named. It now deletes `from` first so the
signature check is what fires, and scenario 6 covers ES-15 on its own. A scenario that passes for
the wrong reason is worse than one that fails.

The harness lives at `scratchpad/t8-externalSigner.js` (ESM — `wallet-broadcasting` is
`type: module`); one exported function per scenario, one invoked per run, per 003's T-8 format.

**Note for whoever runs this:** every chain in `NETWORKS_REGISTRY` is EIP-1559-capable and
`prepareTransaction` always populates the type-2 fee fields, so scenario 1 exercises **type 2 only**.
Type 1 and type 0 are unreachable through the normal flow (OQ-1) and are covered by T-2's `pure`
check alone. Do not hand-craft a `gasPrice`-only transaction here just to reach type 1 — it would be
a transaction no consumer of this SDK can actually produce.

**Verify** `chain` — **7/7 scenarios passed**, all recorded in the table above. Scenario 1 confirmed
by a real hash reaching `success` via `txStatus` and then re-checked from an independent RPC:
receipt `status: 1`, `tx.type: 2`, `tx.from` equal to the signer's address on the mined transaction,
sender nonce advanced 0 → 1. Scenarios 2–7 ran against the same live chain and preparer, with
`signDigest`'s call counter asserted on every one (`1` where the signer should answer, `0` where a
guard must fire first).

**This task earned its place.** It found the ES-3/`from` defect that 29 local assertions in T-2 had
missed, which forced clause ES-15 and a third error code — and scenarios 5 and 6 had to be split
afterwards because the new guard silently preempted the one scenario 5 was named for. Both are
recorded in T-2 and above.
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
