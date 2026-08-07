# 003 — Tasks

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

**Standing rule (001 D-11, FC-17, CFC-18)** — a task that creates public surface exports it from
`src/index.ts` in the same change, in the existing explicit-barrel style. Nothing under
`src/swap/internal/` is ever exported. A task is not closed while its public symbols are unreachable
from the package entry point.

**Rule specific to this spec** — three tasks (T-5, T-3's same-chain half, T-8's scenario 6) exist to
prove that something did **not** change. They are not optional bookkeeping: CC-2 and CFC-7 promise a
consumer that its 1.8.0 same-chain flow keeps working untouched, and that promise is the easiest one
in this feature to break by accident.

---

## Foundations

### [x] T-1 · Settlement types, and the two closed-set changes
**Files:** `src/types/swap.ts`, `src/index.ts`
**Satisfies:** CC-28, CC-29, CC-30, CFC-15, CFC-16 · **Plan:** D-6, D-9

Add `SwapSettlementOutcome`, `SwapSettlementReason`, `SwapSettlementReport` and
`GetSwapSettlementParams` exactly as D-6 declares them. `SwapSettlementOutcome` is written as
`Exclude<SwapTxOutcome, 'not-submitted'>` and **not** as a fresh three-member union — the derivation
is the point, not a shorthand.

In `SwapErrorCode`: remove `'CROSS_CHAIN_NOT_SUPPORTED'` (CC-28), add `'UNSUPPORTED_RECIPIENT'`
(CC-29). The set stays nine. All four new types re-exported from `src/index.ts` under the existing
`/** swap types exports */` block (standing rule).

**Verify** `pure` — `SwapErrorCode` has exactly nine members and the retired code is not among them;
`SwapSettlementReason` exactly three; both confirmed by an exhaustive `switch` with no `default`,
compiled with `tsc --strict --noEmit`. **The load-bearing check of D-6 is an assignability one and is
verified by the compiler, not by reading:** a value typed `SwapSettlementOutcome` is accepted where
`ResolveSwapStateParams['outcome']` is expected with no cast, and `@ts-expect-error` confirms
`'not-submitted'` is rejected as a `SwapSettlementOutcome` and `'CROSS_CHAIN_NOT_SUPPORTED'` is
rejected as a `SwapErrorCode`. All asserted in a scratch file, compiled clean, then deleted — a
runtime check cannot see any of this.
`review` — the four types resolve from `src/index.ts`. At the time this task closed, `grep -rn
"CROSS_CHAIN_NOT_SUPPORTED" src/` still returned the raise site in `getSwapQuote.ts` — expected,
since removing it is T-3's job, not this one's. With T-3 now also landed, the grep returns exactly
three hits, all traceability comments (two in this file's header, one in `getSwapQuote.ts`'s), and
zero code that raises or assigns the retired literal.
**Depends on:** —

---

## LI.FI access

### [x] T-2 · `fetchSettlement` adapter
**File:** `src/swap/internal/lifiClient.ts`
**Satisfies:** CC-11, CC-13, CC-14, CC-15, CC-16, CC-17, CC-18, CC-19, CC-21 · **Plan:** D-1, D-2, D-7

Add `getStatus` to the single `@lifi/sdk` import line — this file stays the only importer (001's
D-1). `fetchSettlement({ txHash, fromChainId, toChainId })` implements D-2's mapping table in full,
including the two rows never observed live (`200 / NOT_FOUND`, `200 / INVALID`). Internal module: not
exported from the barrel.

**The one thing this task must get right**, and the reason it is its own task rather than a few
lines inside T-4: **the 404 branch must not be shared with `fetchQuote`.** A 404 from `/status` maps
to `pending`; the same status maps to `NO_ROUTE` twelve lines away
([lifiClient.ts:124-129](../../src/swap/internal/lifiClient.ts#L124-L129)). Only `httpStatusOf` and
`upstreamMessageOf` are reused, because they read shape and carry no policy.

`receiving` is read defensively (D-7): absent on a failed transfer, and `{ chainId }` only on a
pending one. `receivedAmount`/`receivedToken`/`destinationTxHash` stay undefined in those cases and
are never back-filled from `sending` or from the quote (CC-19).

**One row the table doesn't spell out was resolved while implementing, not left implicit:** `status:
'DONE'` with `receiving` still shaped like `PendingReceivingInfo` (chainId only) is a contradiction
the upstream type technically allows but the live service never produced. Treated as `success` with
every optional field undefined rather than thrown — `toSettlementReport`'s `switch` trusts the
top-level `status` field as authoritative and never inspects `receiving` to *decide* the outcome,
only to enrich it.

**Verify** `pure` — 15 fixture cases via an `@lifi/sdk` faked by replacing its entry in Node's
`require.cache` before requiring the compiled adapter (same technique 001's T-5 used), all passing:
every row of D-2's table, including the two 200-body shapes never observed live (`NOT_FOUND`,
`INVALID`) and an unrecognised `status` literal falling to `PROVIDER_ERROR` via the `default` branch;
a `receiving`-absent body (measured `FAILED` shape) and a `receiving`-pending-shaped body on a `DONE`
status each yield a report with the three optional fields undefined and throw nothing; `fromChain`/
`toChain` confirmed forwarded to `getStatus` unchanged. The regression that matters, asserted
explicitly: **HTTP 404 yields `pending` and never `NO_ROUTE`.**
`chain` — the five live probes from D-2 and D-3 replayed through this function rather than through
raw `fetch`, all matching: unknown hash → `pending`; malformed hash → `failed`/`not-recognized`; the
real non-transfer hash → `failed`/`not-recognized`; the real completed same-chain LI.FI swap →
`success` with `receivedAmount: 1032392n`, `receivedToken` USDC/6, and `destinationTxHash` equal to
the origin hash (the same-chain artefact D-7 predicted, harmless since this operation is never called
for a same-chain swap in practice); the real reverted transaction from D-3 → `failed`/`execution-failed`,
confirming D-3's finding through the actual adapter code path rather than raw `fetch`. **5/5 passed.**
**Depends on:** T-1

---

## Public operations

### [x] T-3 · `getSwapQuote` accepts differing chains
**File:** `src/swap/getSwapQuote.ts`
**Satisfies:** CC-1, CC-2, CC-3, CC-4, CC-6, CC-7, CC-8, CC-28 · **Plan:** D-5

D-5's four edits, in this validation order so nothing costs a round-trip to learn a local input was
malformed:

1. slippage (SDK-37, unchanged)
2. **new** — chains differ and `toAddress` is supplied and does not normalize equal to `fromAddress`
   → `UNSUPPORTED_RECIPIENT` (CC-6). Comparison through `normalizeEvmAddress`, so a checksum
   difference is not a rejection. Same-chain never reaches this guard (CC-2)
3. **removed** — the `fromChainId !== toChainId` rejection (CC-1)
4. **widened** — both chains checked against the supported set (CC-3)
5. **split** — `fetchTokensForChains([fromChainId, toChainId])`, each token resolved against its own
   chain's list (CC-4)

`parsedAmount` keeps using the **origin** token's decimals — that is where the input amount is
denominated (SDK-2). No barrel change: `getSwapQuote` was already exported.

**One fixture bug worth recording, caught before it could hide a real defect:** the first pass at
the fixtures used non-hex placeholder token addresses (e.g. `'0xfromtoken56'`). `normalizeEvmAddress`
correctly returns `null` for all of them, which made every comparison `null === null` — spuriously
matching regardless of which token was actually being looked for, and masking exactly the case (E,
below) the fixture existed to catch. Fixed by generating syntactically valid 20-byte hex addresses
programmatically; not a defect in the implementation.

**Verify** `pure` — 12 fixture cases via the same `require.cache`-injected fake `@lifi/sdk` as T-2,
each case using chain ids untouched by any earlier one in the same process (002's process-lifetime
token cache, the trap 001's T-7 recorded and paid for): a cross-chain request with a differing
`toAddress` yields `UNSUPPORTED_RECIPIENT` with **zero** network calls, while the same differing
`toAddress` on a **same-chain** request still succeeds (CC-2 — the assertion that catches the guard
being written one condition too wide); an unsupported destination chain fails locally with the
destination id in `details`, and an unsupported origin chain likewise, both with zero network calls;
a token present on the origin chain but absent from the destination chain's list yields
`UNSUPPORTED_TOKEN` — deliberately designed so the *same* token address also exists in the origin's
registry, reproducing **the exact case the old code could not detect**, since it checked `toToken`
against the origin's list only and would have wrongly accepted it there; a same-chain request is
confirmed to perform exactly one `getTokens` call, with a single chain id and not a duplicated pair
(D-5's dedupe claim). **12/12 passed.**
`chain` — a live cross-chain quote on the D-4 pair (Polygon USDC → Base USDC): `toToken` carries
Base's own decimals (6), `toAmountMin` (`1992209`) is denominated in the destination token's units
(CC-7), a real spender comes back, and `expiresAt` landed 30.0–31.6 s out, consistent with network
latency around the boundary (CC-8). A second live call with `toAddress` explicitly equal to
`fromAddress` on the same cross-chain pair confirmed CC-6's guard does not reject the identity case.
**Depends on:** T-1

### [ ] T-4 · `getSwapSettlement`
**File:** `src/swap/getSwapSettlement.ts` (new), `src/index.ts`
**Satisfies:** CC-11, CC-12, CC-20, CC-22, CC-30 · **Plan:** D-8

Thin public wrapper over T-2's adapter: `{ txHash, fromChainId, toChainId }` in,
`SwapSettlementReport` out. No `rpcUrl` — it reads no chain. No quote (CC-12). **No chain-support
guard** (D-8): it answers about funds already in flight, and refusing because a chain left the
supported set would strand a consumer mid-swap.

No timer, no deadline, no retry, no module-level state (CC-20, CC-22). Exported from `src/index.ts`
(standing rule).

**Verify** `pure` — the invariant D-6 chose not to encode in the type is asserted here instead:
`reason` is present exactly when `outcome === 'failed'`, and `receivedAmount`/`receivedToken`
exactly when `outcome === 'success'`, across every row of D-2's table. A supported-chain pair and an
**unsupported** one produce the same behaviour, confirming no guard crept in. `Date.now` monkey-
patched to throw is not touched (CC-20 — no clock means no deadline), the same empirical method 001's
T-10 used for SDK-25.
`review` — `getSwapSettlement` resolves from the package entry point; the file contains no
`setTimeout`, no loop and no module-scope binding.
**Depends on:** T-2

### [ ] T-5 · Prove the untouched files are untouched
**Files:** none (audit)
**Satisfies:** CC-2, CC-9, CC-10, CC-23, CC-24, CFC-1, CFC-7 · **Plan:** D-4

D-4 claims the approval and build paths need no change, and D-3 claims the state machine needs none.
Both are claims about a **diff**, so they are verified as one.

- `git diff main -- src/swap/buildSwapApprovalTxs.ts src/swap/buildSwapTx.ts
  src/swap/resolveSwapState.ts` is **empty** (CC-9, CC-10, CC-23, CC-24) — the standard 001's T-13
  applied to `broadcastTransaction.ts`, which stays empty here too (SDK-35).
- `SwapState` still has exactly five members (CC-24), and `resolveSwapState`'s eight-cell table is
  unchanged.
- **FC-13 is verified against the published package, not against this repo's own history:**
  `npm pack @octaflowlabs/onchain-sdk@1.8.0`, extract its `dist/index.d.ts`, and diff the four 001
  operation declarations plus `getSwapSupportedChainIds` against the ones this branch emits. They
  must be **character-identical**. That is what "lifting the restriction will not change any
  signature" means, and reading the source cannot establish it.

The expected declaration-level diff against 1.8.0 is exactly three things: `SwapErrorCode`'s two
member changes, the four new settlement types, and `getSwapSettlement`. Anything else in that diff is
a defect this task exists to catch.

**Verify** `review` — the three diffs confirmed empty; the `.d.ts` comparison against the published
1.8.0 tarball recorded member by member.
**Depends on:** T-3, T-4

---

## Integration

### [ ] T-6 · Audit the public export surface
**File:** `src/index.ts`
**Satisfies:** CFC-18 · **Plan:** D-8, public surface

Each preceding task exported its own symbols under the standing rule; this confirms the result is
complete and contains nothing more.

| Must be exported | From |
|---|---|
| `getSwapSettlement` | `swap/getSwapSettlement` |
| `SwapSettlementOutcome`, `SwapSettlementReason`, `SwapSettlementReport`, `GetSwapSettlementParams` | `types/swap` |

Must **not** be exported: `fetchSettlement`, and anything else under `swap/internal/`.

**Verify** `review` — the five symbols cross-checked against `src/index.ts` and against the built
`dist/index.d.ts`; `grep -n "internal/" src/index.ts` and `grep -n "export \*" src/index.ts` return
nothing; `grep -rln "@lifi/sdk" src/` still returns exactly one file, confirming 001's D-1 isolation
survived this feature too. Then, as 001's T-12 did, **import the built package from outside the repo
tree** exactly as a consumer would and confirm `getSwapSettlement` resolves as a function from the
bare entry point while `fetchSettlement` is `undefined` on the barrel object.
**Depends on:** T-4

### [ ] T-7 · Document the public surface
**File:** `README.md`
**Satisfies:** CFC-1 – CFC-18 · **Plan:** public surface, consumer flow, R-2

Extend the existing "Swaps" section rather than adding a second one — a consumer reading about swaps
must not have to discover that cross-chain is documented elsewhere. Must state explicitly, because
none of it is inferable from the signatures:

- **CFC-6** — for a cross-chain swap the swap phase's outcome comes from `getSwapSettlement` and
  never from `txStatus`. This is the one that costs money to get wrong
- **CFC-11** — a completed swap may deliver less, or a different token; show `receivedAmount` /
  `receivedToken`, not the quoted figures
- **CFC-12** — `error` with reason `refunded` means the input is back on the origin chain
- **CFC-8** — persist the origin hash **and both chain ids**; that is the whole resumption state
- **CFC-7** — same-chain is unchanged; the existing 1.8.0 flow needs no edit
- **CFC-15** — `CROSS_CHAIN_NOT_SUPPORTED` is gone and the branch must be deleted (the compile break
  argued in D-9 — the release note points here)
- **CFC-16** — two closed sets: error codes are caught, settlement reasons are read off a report
- **CFC-13 / R-2** — the consumer owns the cadence and the SDK publishes no timeout; recommend a
  floor of one request every 5–10 s with backoff on `PROVIDER_ERROR`. A recommendation, not a clause

Signatures pulled from the built `dist/*.d.ts`, never from plan.md — the plan is a design-time
artifact and may have drifted from what shipped, which is the discipline 001's T-14 established after
finding exactly that.

An HTML comment citing the clause ids sits at the top of the new subsection, per CLAUDE.md's
traceability exception.

**Verify** `review` — every documented signature matches the emitted `.d.ts`; all eight call-outs
present.
**Depends on:** T-6

### [ ] T-8 · On-chain verification run
**Files:** none (records land in this file)
**Satisfies:** CC-1, CC-4, CC-6, CC-11, CC-13, CC-14, CC-18, CC-19, CC-25, CC-26, CFC-4, CFC-7 end to end
**Plan:** verification approach

Executed manually from the `wallet-broadcasting` test repo against a symlinked build, using the SDK's
own `signTransaction` + `broadcastTransaction`, as in 001 and 002. Chains: **Polygon (137), Base
(8453), Linea (59144), BSC (56), Scroll (534352)** — all five are in 001's supported set.

Cross-chain runs differ from 001's in one practical respect: the interesting part is the *middle*.
**Every settling scenario records the report at three points** — immediately after broadcast
(expected `pending`, arriving as a 404), mid-flight (expected `pending`, arriving as a 200), and at
settlement. The first of those three is the only observation that exercises D-2's 404→`pending`
mapping, which is the single most consequential line in this feature.

| # | Scenario | Chains | Pair | Gas | Clauses | Result |
|---|---|---|---|---|---|---|
| 1 | cross-chain, native input, zero approvals | Base → Polygon | ETH → USDC | yes | CC-1, CC-11, CC-14, CC-18, CC-25, CC-26 | |
| 2 | cross-chain ERC-20 → ERC-20, first time: approval on origin + mandatory re-quote (FC-15) | Polygon → Base | USDC → USDC | yes | CC-9, CC-10, CFC-4, CFC-17 | |
| 3 | same pair repeated, empty approval list | Polygon → Base | USDC → USDC | yes | SDK-15 across chains | |
| 4 | **same-chain regression** — a full 1.8.0 flow, unedited, and `getSwapSettlement` never called | Scroll or Linea, one chain | any | yes | CC-2, CFC-7 | |
| 5 | destination-chain token validation: a token that exists on origin and not on destination | BSC → Linea | a BSC-only token | **no** | CC-4 | |
| 6 | cross-chain with a differing `toAddress` → `UNSUPPORTED_RECIPIENT`, zero network calls | Polygon → Base | any | **no** | CC-6 | |
| 7 | cross-chain quote held past 30 s → `QUOTE_EXPIRED` | Polygon → Base | USDC → USDC | **no** | CC-8 | |
| 8 | settlement asked with a hash that is real but scoped to the wrong chain pair → `pending`, indefinitely | reuse scenario 1's hash | — | **no** | CC-13, CC-20, R-1 | |

Scenarios 5–8 spend no gas: three fail before any transaction is built, and 8 reuses a hash scenario
1 already produced. Only 1–4 cost real funds.

**Two things worth recording if they occur, neither engineered for:** a `PARTIAL` settlement (R-3 —
would close the one branch of CC-18 that no scenario provokes deliberately), and any HTTP 429 during
the three-point polling (R-2 — the rate-limiting risk, which only sustained real polling can
measure). Note the elapsed origin-to-settlement time on each of 1–3 regardless; the README's cadence
recommendation is currently a guess and this is the only chance to ground it.

**Not covered here, stated plainly rather than left implicit:** a genuine cross-chain **revert** on
the origin chain, which would close R-5 by confirming D-3's `FAILED` finding against a bridge rather
than against a same-chain swap. Provoking one deliberately costs a transaction to set up and cannot
be made to happen on demand.

**Verify** `chain` — every scenario recorded with real hashes, the three-point report readings, and
elapsed times.
**Depends on:** T-6

### [ ] T-9 · Release 1.9.0
**File:** `package.json`
**Satisfies:** — · **Plan:** target release, D-9

Bump `1.8.0` → `1.9.0`. Minor, with the compile break of D-9 accepted deliberately and stated in the
release note: **`CROSS_CHAIN_NOT_SUPPORTED` is removed from `SwapErrorCode`, and a consumer with a
`case` for it will not compile.** That note is not optional — it is the entire reason the break is
acceptable at a minor rather than a major.

Run `yarn prettier`, then `yarn build`, and confirm both ESM and CJS outputs plus declarations before
publishing. Published manually by the user, per their standing preference.

**Verify** `review` — `dist/index.d.ts` exports the full swap surface including
`getSwapSettlement`; `dist/cjs` builds. After publishing, confirm against the **live registry** that
`1.9.0` is present *and* that the `latest` dist-tag points at it — 001's T-16 found `latest` stranded
on `1.0.0-test6` while `next` carried the release, so an unpinned `yarn add` installed the wrong
package entirely. Check it, do not assume it moved.
**Depends on:** T-5, T-7, T-8

---

## Clause coverage

Every clause in spec.md maps to at least one task.

| Clause | Task |
|---|---|
| CC-1, CC-3, CC-4, CC-6, CC-7, CC-8 | T-3, T-8 |
| CC-2 | T-3, T-5, T-8 |
| CC-5 | T-3 (unchanged `NO_ROUTE` path) |
| CC-9, CC-10 | T-5, T-8 |
| CC-11, CC-12 | T-2, T-4, T-8 |
| CC-13 – CC-17 | T-2, T-8 |
| CC-18, CC-19 | T-2, T-4, T-8 |
| CC-20, CC-22 | T-4 |
| CC-21 | T-2 |
| CC-23, CC-24 | T-5 |
| CC-25, CC-26, CC-27 | T-5, T-8 |
| CC-28, CC-29 | T-1 |
| CC-30 | T-1, T-4 |
| CFC-1 | T-5, T-7 |
| CFC-4, CFC-5, CFC-6, CFC-10, CFC-11, CFC-12, CFC-13 | T-7, T-8 |
| CFC-2, CFC-3 | T-3, T-7 |
| CFC-7 | T-5, T-8 |
| CFC-8, CFC-9 | T-4, T-7 |
| CFC-14, CFC-17 | T-7 |
| CFC-15, CFC-16 | T-1, T-7, T-9 |
| CFC-18 | every task that creates public surface; audited by T-6 |

**Frontend repo** — the consuming plan references `§Frontend contract` items by id, across all three
specs (`FC-n`, `TFC-n`, `CFC-n`). The spec is not duplicated there. `CROSS_CHAIN_NOT_SUPPORTED` and
any reference to 001's `SDK-9` must be removed there as part of adopting 1.9.0.
