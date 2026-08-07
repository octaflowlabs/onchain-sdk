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

### [x] T-4 · `getSwapSettlement`
**File:** `src/swap/getSwapSettlement.ts` (new), `src/index.ts`
**Satisfies:** CC-11, CC-12, CC-20, CC-22, CC-30 · **Plan:** D-8

Thin public wrapper over T-2's adapter: `{ txHash, fromChainId, toChainId }` in,
`SwapSettlementReport` out. No `rpcUrl` — it reads no chain. No quote (CC-12). **No chain-support
guard** (D-8): it answers about funds already in flight, and refusing because a chain left the
supported set would strand a consumer mid-swap.

No timer, no deadline, no retry, no module-level state (CC-20, CC-22). Exported from `src/index.ts`
(standing rule).

**Verify** `pure` — 20 assertions via the same `require.cache`-injected fake `@lifi/sdk` as T-2, all
passing: the invariant D-6 chose not to encode in the type, asserted here instead — `reason` is
present exactly when `outcome === 'failed'`, and `receivedAmount`/`receivedToken` are absent on every
non-`success` outcome, across every row of D-2's table (including the `PROVIDER_ERROR` row, which
throws rather than returning, as expected); a **supported** chain pair (137/8453) and a nonsense
**unsupported** one (999999999/888888888) produce byte-identical results for the same upstream
response, confirming no chain guard crept in; `Date.now` monkey-patched to throw is never invoked
(CC-20 — no clock means no deadline), the same empirical method 001's T-10 used for SDK-25, and the
call still resolves correctly with the trap installed.
`review` — `getSwapSettlement` resolves as a function from `require('dist/cjs/index.js')`, imported
exactly as a consumer would; `fetchSettlement` (internal) is `undefined` on that same barrel object;
`grep -nE "setTimeout|setInterval|while\s*\(|for\s*\(|new Map\(|new Set\("` against the file returns
nothing — no timer, no loop, no module-scope binding.
**Depends on:** T-2

### [x] T-5 · Prove the untouched files are untouched
**Files:** none (audit)
**Satisfies:** CC-2, CC-9, CC-10, CC-23, CC-24, CFC-1, CFC-7 · **Plan:** D-4

D-4 claims the approval and build paths need no change, and D-3 claims the state machine needs none.
Both are claims about a **diff**, so they are verified as one. Audit-only task, like 001's T-12/T-13:
no source file created or edited, so there is no file to attach a traceability header to. Findings
recorded here instead.

- `git diff main -- src/swap/buildSwapApprovalTxs.ts src/swap/buildSwapTx.ts
  src/swap/resolveSwapState.ts` is **empty** (CC-9, CC-10, CC-23, CC-24) — the standard 001's T-13
  applied to `broadcastTransaction.ts`, which stays empty here too (SDK-35). Confirmed with an exit
  code of `0` and zero output lines, not merely eyeballed.
- `SwapState` still has exactly five members (CC-24): `types/swap.d.ts`'s diff against 1.8.0, below,
  touches only `SwapErrorCode` and the new settlement types — the `SwapState` line is untouched, and
  `resolveSwapState.d.ts`/`.ts` are byte-identical to 1.8.0's, so the eight-cell table stands.
- **FC-13 verified against the published package, not against this repo's own history:** `main` turned
  out to be at `1.7.0` — spec 002 was implemented directly on this branch and never merged, so a
  `git diff main` alone would have proven nothing about `1.8.0`'s actual published surface. `npm view
  @octaflowlabs/onchain-sdk versions` confirmed `1.8.0` **is** published (under the `next` dist-tag,
  `latest` still lagging at `1.7.0` — the same gap 001's T-16 found and fixed for that release; out of
  this task's scope to touch again). `npm pack @octaflowlabs/onchain-sdk@1.8.0`, extracted, and its
  `dist/index.d.ts` diffed against this branch's freshly built one.

**Two findings from that diff, both expected, one requiring an extra step to actually prove:**

- The top-level `index.d.ts` diff is exactly two lines: one new re-export
  (`getSwapSettlement`) and the swap-types re-export line gaining the four new type names. Nothing
  else in the 178-file tarball differs — a full `diff -rq` of the two `dist` trees (ESM half) touches
  exactly six files: `index.d.ts`/`.js`, `getSwapQuote.d.ts`/`.js`, `getSwapSettlement.d.ts`/`.js`
  (new), `swap/internal/lifiClient.d.ts`/`.js`, and `types/swap.d.ts`/`.js`. No file outside the
  feature's own footprint moved.
- **A re-export line being unchanged does not by itself prove a function's signature is unchanged** —
  `index.d.ts` only names what it re-exports; the actual parameter and return types live in each
  operation's own `.d.ts`. `getSwapQuote.d.ts` *does* differ from 1.8.0's (T-3 added the 003
  traceability block to its header comment, which `tsc` carries into the declaration file), so the
  diff alone could not distinguish "only the comment changed" from "the signature also changed."
  Isolated the single `export declare const getSwapQuote: (...) => ...;` line in both files and
  compared it directly: **character-identical.** `buildSwapApprovalTxs.d.ts`, `buildSwapTx.d.ts`,
  `resolveSwapState.d.ts` and `SWAP_SUPPORTED_CHAINS.d.ts` required no such isolation — each is
  byte-identical to 1.8.0's in full, comment included, since nothing in this feature touched those
  five files at all.

The declaration-level diff against 1.8.0 landed exactly on the three things predicted: `SwapErrorCode`
losing `CROSS_CHAIN_NOT_SUPPORTED` and gaining `UNSUPPORTED_RECIPIENT`, the four new settlement types
(`SwapSettlementOutcome`, `SwapSettlementReason`, `SwapSettlementReport`, `GetSwapSettlementParams`),
and `getSwapSettlement` itself. Nothing else.

**Verify** `review` — `git diff main` on the three files confirmed empty by exit code; the full ESM
`dist` tree diffed file-by-file against the `1.8.0` tarball (6/178 files differ, all within this
feature's footprint); `getSwapQuote`'s actual signature line isolated and confirmed character-identical
independent of its changed header comment; the other four FC-13-relevant declaration files confirmed
byte-identical in full.
**Depends on:** T-3, T-4

---

## Integration

### [x] T-6 · Audit the public export surface
**File:** `src/index.ts`
**Satisfies:** CFC-18 · **Plan:** D-8, public surface

Each preceding task exported its own symbols under the standing rule; this confirms the result is
complete and contains nothing more.

| Must be exported | From |
|---|---|
| `getSwapSettlement` | `swap/getSwapSettlement` |
| `SwapSettlementOutcome`, `SwapSettlementReason`, `SwapSettlementReport`, `GetSwapSettlementParams` | `types/swap` |

Must **not** be exported: `fetchSettlement`, and anything else under `swap/internal/`.

**No edits were needed**, exactly as with 001's T-12: T-1 and T-4 already added their own exports
under the standing rule, so this task is a confirmation, not a batch of fixes. `src/index.ts` carries
no JSDoc traceability header of its own — it never has, in either 001 or 002 — so there is no header
to add here; the barrel's role is mechanical re-export, and the convention places the traceability
block on the feature file that defines each symbol, not on the file that re-exports it.

**Verify** `review` — the five symbols cross-checked against `src/index.ts` and against the built
`dist/index.d.ts`: **5/5 present in both.** `grep -n "internal/" src/index.ts` and `grep -n "export \*"
src/index.ts` both return nothing; `grep -rln "@lifi/sdk" src/` still returns exactly one file
(`swap/internal/lifiClient.ts`), confirming 001's D-1 isolation survived this feature too. Then, as
001's T-12 did, **imported the built package from outside the repo tree** — a `node -e` invocation run
from the scratch directory, not this one — exactly as a consumer would: `getSwapSettlement` resolves
as a function from the bare entry point, while `fetchSettlement`, `isSwapSupportedChain`,
`readAllowance` and `isNativeTokenAddress` are all `undefined` on that same barrel object.
**Depends on:** T-4

### [x] T-7 · Document the public surface
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
traceability exception. The existing comment before `### Swaps` (001's `FC-1..FC-16`) was extended in
place with `CFC-1..CFC-18`, rather than adding a second comment, since 003's content joins that same
section rather than starting a new one.

**One drift caught by pulling from `dist/*.d.ts` instead of copying from plan.md**, exactly the
discipline this task exists to enforce: `getSwapSettlement`'s destructured parameter list in the
built declaration — `({ txHash, fromChainId, toChainId, }: GetSwapSettlementParams) => ...` — is
simplified in the README table to `(params: GetSwapSettlementParams) => ...`, matching the
established convention for every other entry (`getBalance`, `getSwapQuote`, etc., all of which also
destructure in source). Not a discrepancy, just confirming which convention applies before writing it
down.

**One line outside the Swaps section was also stale and is not scoped to this task, but was fixed
here rather than left inconsistent with what the task just wrote:** the file's own top-level
description (line 3–5) still read "EVM same-chain swaps via LI.FI." Updated to "same-chain and
cross-chain EVM swaps via LI.FI."

**Verify** `review` — `getSwapSettlement`'s signature and `SwapSettlementReport`'s field list
cross-checked against `dist/swap/getSwapSettlement.d.ts` and `dist/types/swap.d.ts` directly, not
plan.md. All eight required call-outs confirmed present by grep, one clause at a time: CFC-6
(`switch to feeding the outcome from getSwapSettlement`), CFC-7 (`Same-chain swaps are unchanged in
every respect`), CFC-8 (`Persist the origin transaction hash and both chain IDs`), CFC-11 (`may
deliver less than quoted`), CFC-12 (`` reason `refunded` ``), CFC-13/R-2 (`There is no timeout`),
CFC-15 (`` `CROSS_CHAIN_NOT_SUPPORTED` no longer exists ``), CFC-16 (`**second, disjoint** closed
set`). `grep -n "CROSS_CHAIN_NOT_SUPPORTED" README.md` returns exactly the one intentional mention;
`yarn prettier --check README.md` and `yarn build` both clean.
**Depends on:** T-6

### [x] T-8 · On-chain verification run
**Files:** none (records land in this file)
**Satisfies:** CC-1, CC-4, CC-6, CC-11, CC-13, CC-14, CC-18, CC-19, CC-25, CC-26, CFC-4, CFC-7 end to end
**Plan:** verification approach

Executed manually from the `wallet-broadcasting` test repo against a symlinked build, using the SDK's
own `signTransaction` + `broadcastTransaction`, as in 001 and 002. Chains actually used: **Base
(8453), Polygon (137), Scroll (534352), BSC (56), Linea (59144)** — the full five-chain set named in
the plan. Each scenario ran as its own exported function in one shared harness file; only one is
invoked per run.

Every settling scenario recorded the report at (at least) two points before settlement, not the three
originally planned — the point that matters most, immediately after broadcast, still landed on every
run: **`t+0.4`–`0.6s`, `outcome: 'pending'`, backed by a live HTTP 404** (`"...not found on chain
'<id>'"`). The distinct "mid-flight, still-404" and "mid-flight, now-200-PENDING" split collapsed in
practice because every settlement completed in **8–9 seconds** — Across (the tool LI.FI routed all
three funded scenarios through) settles fast enough that there was rarely a second poll before the
third one already showed `success`. The 404→`pending` mapping, the single most consequential line in
this feature, is confirmed live in scenarios 1, 2 and 3 alike.

| # | Scenario | Chains | Pair | Gas | Result |
|---|---|---|---|---|---|
| 1 | cross-chain, native input, zero approvals | Base → Polygon | ETH → USDC | yes | swap `0x1b421b2fad81ae9e85c82b83f20dea57217a45745797221a6c994502cbd7b86e`; destination `0xb36b658d33c6350b8eb76d1d70435f058faa38c9cfa6cacdd5d19e6da03bffeb`; `pending` (404) at t+0.6s and t+0.7s, `success` at t+8.6s; received `3775766` USDC (6dp) against a quoted `toAmountMin` of `3756886` — above the guaranteed minimum, as it must be |
| 2 | cross-chain ERC-20 → ERC-20, first time: approval on origin + mandatory re-quote | Polygon → Base | USDC → USDC | yes | approval `0x040d41eb8bd75b281ec76b8dde220c1d3a6040bbd3513360da4d7f57b4201642` (nonce 5, one tx — starting allowance was 0, the SDK-16 path); re-quoted after confirmation as FC-15 requires; swap `0xc70a3f75484da9814a2703ff88a85eacf1540d0f167c3842b57382c4ff66466d`; destination `0x81204a91ead073196c823fe299b0b09d30cb0d6082d2a9bf926cf9fd2ba46012`; `pending` (404) at t+0.4s and t+0.6s, `success` at t+8.1s; received `994817` USDC (6dp) |
| 3 | same pair repeated, empty approval list | Polygon → Base | USDC → USDC | yes | on-chain allowance read as `MaxUint256` against a required `1000000` — confirmed real, not assumed; `buildSwapApprovalTxs` → `[]`; swap `0x8257fd55e84b30accd1d8ddd799c33bc05630cee71ca0c48aa1541490b318004`; destination `0x9a448810601206b520c938fbebbee249237799b7fda121db031c98dc2cb17b2d`; `pending` (404) at t+0.4s and t+0.5s, `success` at t+8.4s; received `994815` USDC (6dp) |
| 4 | **same-chain regression** — a full 1.8.0 flow, unedited, `getSwapSettlement` never called | Scroll, one chain | ETH → WETH (native wrap) | yes | `buildSwapApprovalTxs` → `[]` (native input); swap `0x3e3c28e3e0969bc2111023e8b2af68cb8e6aeff3893ff99bf85fdc61df464410`; `resolveSwapState({ phase: 'swap', outcome: 'success' })` → `'done'` via the ordinary `txStatus`-driven path, exactly as in 001; the harness's own source confirms `getSwapSettlement` is not called anywhere in this scenario's code path |
| 5 | destination-chain token validation | BSC → Linea | CAKE (`0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82`), present on BSC, confirmed absent from Linea via `getAllSwapTokens` before quoting | no | `getSwapQuote` → `SwapError { code: 'UNSUPPORTED_TOKEN', message: 'One or both tokens are not swappable on their own chain' }` — the exact string T-3 wrote, confirming the destination-aware lookup ran, not the retired origin-only one |
| 6 | cross-chain with a differing `toAddress` → `UNSUPPORTED_RECIPIENT` | Polygon → Base | native → USDC | no | See note below — first attempt was a harness setup error, not a real run of this case. Corrected rerun: `SwapError { code: 'UNSUPPORTED_RECIPIENT', message: 'A cross-chain swap can only deliver to the address supplying the input' }`. The same-chain control case in the same script (identical distinct `toAddress`, `fromChainId === toChainId`) succeeded both times, confirming CC-2 |
| 7 | cross-chain quote held past 30 s | Polygon → Base | USDC → USDC | no | held 35.0s past `expiresAt` → `SwapError { code: 'QUOTE_EXPIRED', message: 'This quote has expired; request a new one' }` |
| 8 | settlement asked with a real hash scoped to the **wrong chain pair** | reused scenario 1's real hash, queried against Linea/Scroll — a pair that hash has nothing to do with | no | See note below — **did not stay `pending`**. Resolved to `success` on the 4th poll (20s in, 5s apart), carrying the correct settlement data for the real Base→Polygon transfer. R-1 corrected in plan.md |

Scenarios 5–8 spent no gas: three fail before any transaction is built, and 8 reuses a hash scenario 1
already produced. Only 1–4 cost real funds.

**Scenario 6, explained rather than just re-run.** The first attempt threw `PROVIDER_ERROR` with an
upstream message (`"None of the available routes could successfully generate a tx"`) instead of
`UNSUPPORTED_RECIPIENT` — flagged `UNEXPECTED` by the harness's own assertion. Confirmed with the
user: that attempt used the **same address for `toAddress` and `fromAddress`**, so CC-6's guard
correctly did not fire (it only rejects a *differing* recipient), and the request went to the network
where an unrelated, transient RPC failure produced the `PROVIDER_ERROR`. Not a false result — a
different case than the one intended. The corrected rerun, with a genuinely distinct `toAddress`
(`0x000000000000000000000000000000000000dEaD`), produced `UNSUPPORTED_RECIPIENT` as expected. CC-6's
guard is a synchronous, zero-network local check (T-3's fixtures already proved this exhaustively);
nothing about this incident implicates it.

**Scenario 8 is the one genuine finding of this run, and it corrects a stated risk rather than
confirming one.** The harness's actual code (`scenario8_settlementWrongChainPair`) queried
`getSwapSettlement` with `fromChainId: LINEA.chainId, toChainId: SCROLL.chainId` against scenario 1's
real Base→Polygon hash — a deliberately, verifiably wrong pair, not a harness bug. LI.FI's `/status`
resolved it anyway, correctly, on the 4th poll. **`fromChain`/`toChain` do not gate the lookup — LI.FI
finds a transfer by hash alone**, and the chain parameters only shape the 404 message when the hash
truly isn't found (consistent with what D-2 already measured: a chain-specific 404 message when a
chain is supplied, a chain-agnostic one when none is). R-1 in plan.md claimed indefinite `pending` for
this exact case; that claim is empirically false and has been rewritten there with this finding,
dated. The "wrong hash entirely" half of R-1 is untouched and still holds — every unrelated 404
observed across all eight scenarios confirms it.

**Two things flagged as worth recording if they occurred — neither did.** No `PARTIAL` settlement
(R-3's open branch of CC-18 stays unexercised) and no HTTP 429 during any polling (R-2's rate-limiting
risk stays unmeasured under real sustained load — three settlements at ~8s each is not sustained
enough to say anything about it either way).

**Elapsed origin-to-settlement time, grounding the README's cadence recommendation for the first
time with real data:** 8.6s, 8.1s, 8.4s across scenarios 1–3. All three routed through Across. This is
far faster than the "minutes" framing used throughout spec.md and plan.md's prose — that framing is
not wrong (LI.FI can and does route through slower bridges, and nothing here bounds worst case), but
the README's 5–10s polling floor is now confirmed to land a consumer 1–2 polls into a typical Across
settlement, not dozens.

**Not covered here, stated plainly rather than left implicit:** a genuine cross-chain **revert** on
the origin chain, which would close R-5 by confirming D-3's `FAILED` finding against a bridge rather
than against a same-chain swap. Provoking one deliberately costs a transaction to set up and cannot be
made to happen on demand.

**Verify** `chain` — 8/8 scenarios recorded with real hashes (1–4), real error codes and messages
(5–8), and elapsed times. One correction made to plan.md (R-1) on the strength of scenario 8's result,
not swept into a footnote. A consumer-facing consequence of that same finding — a wrong chain pair
paired with a real hash resolves silently rather than erroring — was also added to README.md's
cross-chain behaviors list, since it is exactly the kind of thing FC-11/CFC-16's "the consumer can
branch exhaustively" promise does not cover: there is no error code for it to branch on.
**Depends on:** T-6

### [x] T-9 · Release 1.9.0
**File:** `package.json`
**Satisfies:** — · **Plan:** target release, D-9

Bump `1.8.0` → `1.9.0`. Minor, with the compile break of D-9 accepted deliberately and stated in the
release note: **`CROSS_CHAIN_NOT_SUPPORTED` is removed from `SwapErrorCode`, and a consumer with a
`case` for it will not compile.** That note is not optional — it is the entire reason the break is
acceptable at a minor rather than a major.

Published manually by the user, per their standing preference.

**Gap found and closed, same shape as 001's T-16:** the first check against the live registry showed
`1.9.0` present but the `latest` dist-tag still pointing at `1.7.0` (`next` correctly at `1.9.0`), so
an unpinned `yarn add @octaflowlabs/onchain-sdk` would have installed neither this release nor 1.8.0's
token registry. User ran `npm dist-tag add @octaflowlabs/onchain-sdk@1.9.0 latest`. Re-checked live:
`{ latest: '1.9.0', next: '1.9.0' }`.

**Verify** `review` — the published tarball (`npm pack @octaflowlabs/onchain-sdk@1.9.0`, extracted, not
assumed from the local build) confirmed directly: `getSwapSettlement` present in both
`dist/index.d.ts` and `dist/cjs/index.d.ts`; `SwapErrorCode` carries `UNSUPPORTED_RECIPIENT` and not
`CROSS_CHAIN_NOT_SUPPORTED`; both ESM and CJS `index.js` present; `package.json` inside the tarball
reads `1.9.0`. Registry presence and the `latest` dist-tag confirmed live, after the fix above.
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
