# 001 — Tasks

Execution order for [spec.md](./spec.md) under [plan.md](./plan.md). Every task cites the
clauses it satisfies and how it is verified.

**Verification legend** — `pure`: deterministic, invoked directly against a written expected
value, no chain. `chain`: executed on a low-cost mainnet with real funds, recording tx hash and
result. `review`: satisfied by absence or by shape; confirmed by reading the diff.

**Status legend** — `[ ]` not started · `[~]` in progress · `[x]` done. A task earns `[x]` only
once its own verification has actually run (not merely written) and, per the standing rule
below, its public symbols resolve from `src/index.ts`. A task with public surface still
unreachable from the barrel stays `[~]` regardless of how complete its logic is.

Package manager is **yarn**. Format with `yarn prettier` and compile with `yarn build` before
closing any task.

**Standing rule (D-11, FC-17)** — a task that creates public surface exports it from
`src/index.ts` in the same change, in the existing explicit-barrel style. Nothing under
`src/swap/internal/` is ever exported. A task is not closed while its public symbols are
unreachable from the package entry point.

---

## Foundations

### [x] T-1 · Swap types
**File:** `src/types/swap.ts` (new), `src/index.ts`
**Satisfies:** SDK-1, SDK-2, SDK-5, FC-6, FC-8 · **Plan:** D-4, public surface

Define `SwapState`, `SwapPhase`, `SwapTxOutcome`, `SwapErrorCode`, `SwapTokenInfo`,
`SwapQuote`, and the four parameter interfaces. All amounts typed `bigint`; all boundary
inputs typed `string`. `SwapErrorCode` is a closed union of the nine codes in spec.md.
All twelve types re-exported from `src/index.ts` under a `/** swap types exports */` block
(standing rule, D-11).

**Verify** `pure` — `SwapState` has exactly five members, `SwapErrorCode` exactly nine; a
`bigint`-typed field rejects a `number` at compile time; `tsc --noEmit` passes. `review` — all
twelve types resolve from the package entry point.
**Depends on:** —

### [x] T-2 · `SwapError`
**File:** `src/swap/SwapError.ts` (new), `src/index.ts`
**Satisfies:** SDK-32, FC-11 · **Plan:** D-5

Class extending `Error` with readonly `code` and optional `details`; `name` set to
`'SwapError'`; exported `isSwapError` type guard that checks the `code` field, not
`instanceof` alone, so it survives a bundle boundary where two copies of the class exist.
`SwapError` and `isSwapError` re-exported from `src/index.ts` (standing rule, D-11).

**Verify** `pure` — a thrown `SwapError` is caught, `isSwapError` returns true, `code` and
`name` are readable, a plain `Error` returns false; confirmed at runtime under this repo's
ES2020 target, where `instanceof Error` on a subclass needs no prototype workaround. `review`
— both symbols resolve from the package entry point.
**Depends on:** T-1

### [x] T-3 · Supported chain set
**File:** `src/constants/SWAP_SUPPORTED_CHAINS.ts` (new), `src/index.ts`
**Satisfies:** SDK-7, SDK-8, FC-12 · **Plan:** D-2

The 16 verified chain ids as a frozen readonly array, plus `getSwapSupportedChainIds()` and an
internal `isSwapSupportedChain(chainId)`. Header comment records the verification command
(`GET /v1/chains?chainTypes=EVM`) and the date it was last run. Only `getSwapSupportedChainIds`
is public surface (D-11); `isSwapSupportedChain` stays unexported from the barrel, for T-7 to
import directly.

**Verify** `pure` — checked programmatically against the live `NETWORKS_REGISTRY.ts` content,
not from memory: all 16 ids are present among the registry's active (non-commented) entries;
Sepolia (11155111) is absent from the swap set; `getSwapSupportedChainIds()` returns 16
entries. `review` — `getSwapSupportedChainIds` resolves from the package entry point.
**Depends on:** —

### [x] T-4 · Native token detection
**File:** `src/swap/internal/nativeToken.ts` (new)
**Satisfies:** SDK-14 · **Plan:** D-6

`isNativeTokenAddress(address)` comparing against the zero address through the existing
`normalizeEvmAddress`. No symbol comparison anywhere in the file. Internal module: not
exported from the barrel (D-11).

D-6's premise was confirmed against `GET https://li.quest/v1/tokens` on 2026-07-29 before
implementing: the native currency sits at the zero address on every chain sampled — ETH (Base),
BNB (56), AVAX (43114), xDAI (100), HYPE (999) — and no chain exposes the `0xEeee…` placeholder
other aggregators use. Four different symbols, one address: the empirical case for D-6.

**Verify** `pure` — 13 cases run against the compiled module: zero address true in lowercase
and whitespace-padded form; USDC on Base and Polygon false in checksummed, lowercase and
bad-checksum-uppercase form; the `0xEeee…` placeholder false; `null`/`undefined`/`''`/malformed
hex/garbage all false; no case throws. **All 13 pass.**

An uppercase `0X` prefix returns `false` rather than `true`: ethers' `getAddress` rejects it,
so `normalizeEvmAddress` yields `null`. Left as-is deliberately — inputs reach this function
from LI.FI, which always emits a lowercase `0x`, and diverging here would make this one
function more permissive than every other address input in the SDK. Both possible wrong answers
fail loudly rather than silently: a false negative builds an approval to an invalid address, a
false positive is caught downstream by `INSUFFICIENT_ALLOWANCE` (SDK-21).
**Depends on:** —

---

## LI.FI access

### [x] T-5 · LI.FI adapter
**File:** `src/swap/internal/lifiClient.ts` (new), `package.json`
**Satisfies:** SDK-4, SDK-5, SDK-6, SDK-33, SDK-38 · **Plan:** D-1, D-10

`yarn add @lifi/sdk@3.1.5` — **exact version, no caret** (D-1). Then a thin adapter that is the
only file in the codebase importing from `@lifi/sdk`, so the dependency can be swapped without
touching anything else. It exposes `fetchQuote`, `fetchTokens`, `fetchChains` over the
package's `getQuote`, `getTokens`, `getChains`. Nothing else from the package is imported —
never `executeRoute` or any execution helper.

- Build the `QuoteRequest` by hand and pass it straight to `getQuote`. **No `createConfig`** —
  it only installs SDK-level defaults for execution, which this feature never performs (D-1).
  Attribution goes in the request object as `integrator`; confirm the field name against
  `QuoteRequest` once the package is installed.
- Divide `slippagePercent` by 100 at this single point — `QuoteRequest.slippage` is a fraction
  (SDK-38).
- Map `estimate.approvalAddress` → `SwapQuote.spender`. **Never `transactionRequest.to`**
  (SDK-4). This is the defect in the prior production integration and the one thing this file
  must get right.
- Convert amounts to `bigint`. Estimate amounts arrive as decimal strings, `transactionRequest`
  gas and value fields as hex strings; `BigInt()` handles both, so the distinction only matters
  when reading the fixtures.
- No `transactionRequest` on an otherwise successful response → `SwapError('NO_ROUTE')`. This
  is how the prior integration detected it and it is load-bearing: a 200 can carry no route.
- A thrown error carrying a 404 → `SwapError('NO_ROUTE')`. Any other thrown error — network,
  timeout, 5xx, unparseable — → `SwapError('PROVIDER_ERROR')` with the original in `details`.
  Inspect the error shape `@lifi/sdk` actually throws before writing this branch; do not assume
  it matches a raw `fetch` rejection.
- In-memory per-chain cache for `getTokens`, process lifetime only, no persistence (R-1).

**Findings, verified against the installed 3.1.5 on 2026-07-30:**

- `createConfig` is genuinely unnecessary, but not for the reason D-1 gave. `request()` *does*
  guard on `config.get().integrator` — it just never fires, because `config.js` ships a default
  `integrator: 'lifi-sdk'`. A live `getQuote` with no config call succeeds. The per-request
  `integrator` field exists on `QuoteRequest` as D-1 predicted and is sent for attribution.
- Errors arrive as `SDKError` wrapping an `HTTPError` on `.cause`, carrying numeric `.status`
  and `.responseBody = { message, code }`. Detection is `error.cause.status === 404`, not a
  `fetch` rejection shape.
- `transactionRequest.value` and `.gasLimit` arrive as hex strings; `estimate` amounts as
  decimal strings. `BigInt()` parses both.
- The adapter returns `Omit<SwapQuote, 'expiresAt'>`. Stamping expiry is T-7's job (SDK-5), and
  a placeholder here would have been a quote that is either permanently expired or silently
  valid.

**Verify** `pure` — 9 fixture cases via an injected fake `@lifi/sdk`, all passing: **`spender`
equals `estimate.approvalAddress` in a fixture where it deliberately differs from
`transactionRequest.to`**, and `raw.to` still carries the target unmodified; a 200 without
`transactionRequest` yields `NO_ROUTE`; a missing `approvalAddress` and a malformed amount both
yield `PROVIDER_ERROR`; `0.5` reaches the wire as `0.005` and `15` as `0.15`; `integrator` is
sent; `toAddress` defaults to `fromAddress`.
`chain` — 13 cases against the live API on Base, all passing: happy-path native→USDC returns a
spender, bigint amounts, `toAmountMin <= toAmount`, converted hex fields, output token metadata;
a dust amount (HTTP 404) yields `NO_ROUTE`; a deny-listed token (HTTP 400) yields
`PROVIDER_ERROR`; `fetchTokens` returns 985 tokens for Base and the second call is cache-served.
`review` — `@lifi/sdk` imported in this file and nowhere else (grep confirms one hit);
`package.json` pins `"3.1.5"` with no range specifier; `yarn build` emits both ESM and CJS.
**Depends on:** T-1, T-2

### [x] T-6 · Allowance reader
**File:** `src/swap/internal/allowance.ts` (new)
**Satisfies:** SDK-13, SDK-21 · **Plan:** D-5

`readAllowance({ rpcUrl, chainId, tokenAddress, owner, spender })` using
`ERC20_TOKEN_CONTRACT_ABI` and the existing `getProvider`, returning `bigint`. An RPC failure
**and** a `getProvider` returning `undefined`— it does on some `chainId` failures without
throwing — both raise `SwapError('PROVIDER_ERROR')` rather than returning zero. A silent zero
would fabricate an approval requirement: a wallet with sufficient allowance would be sent an
unneeded approval because the read failed, not because the allowance was actually low.
Internal module: not exported from the barrel (D-11) — only `getSwapQuote` and `buildSwapTx`
call it directly.

**Verify** `chain` — on Base, read a real wallet's allowance to a real spender via this
function, then independently re-derive the same reading with a hand-encoded `eth_call`
(bypassing this file's `ethers.Contract` usage entirely) and confirm they match — this catches
an `allowance(owner, spender)` argument-order mistake that a same-library comparison would not.
Also confirmed the two argument orders produce different calldata, so the ABI call is not
accidentally symmetric. `pure` — an unreachable RPC URL and a token address that is not a
contract both raise `SwapError('PROVIDER_ERROR')`, never a silent value.
**Depends on:** T-2

---

## Public operations

### [x] T-7 · `getSwapQuote`
**File:** `src/swap/getSwapQuote.ts` (new), `src/index.ts`
**Satisfies:** SDK-5, SDK-6, SDK-8, SDK-9, SDK-10, SDK-36, SDK-37, SDK-38 · **Plan:** D-5, D-10

Validation strictly in this order, so nothing costs a round-trip to learn a local input was
malformed:

1. slippage ≤ 0 or > 15 → `INVALID_SLIPPAGE` (SDK-37); absent → default `0.5` (SDK-36)
2. `fromChainId !== toChainId` → `CROSS_CHAIN_NOT_SUPPORTED` (SDK-9)
3. chain not in T-3's set → `UNSUPPORTED_CHAIN` (SDK-8)
4. either token absent from `/tokens` → `UNSUPPORTED_TOKEN` (SDK-10)
5. fetch the quote; stamp `expiresAt = Date.now() + 30_000` (SDK-5)

Amounts parsed from decimal strings with `parsedAmount` using each token's own decimals
(SDK-2) — `fromToken.decimals` comes out of the same `/tokens` lookup that step 4 performs, so
that lookup is load-bearing for two reasons, not one. The returned quote carries the output
token's address and decimals (SDK-5). Exported from `src/index.ts` (standing rule, D-11).

A malformed address (bad checksum) is not a crash: `normalizeEvmAddress` returns `null` for it,
so it simply never matches an entry in the token list and the request falls through to
`UNSUPPORTED_TOKEN` — the same place an address for a real but unlisted token lands. Not
specified by name in spec.md, but a direct consequence of SDK-10's wording ("either token
cannot be swapped") and confirmed deliberately rather than left as an accident.

**Verify** `pure` — 8 fixture cases via an injected fake `@lifi/sdk`, all passing: slippage
`0`, `-1`, `15.0001` and `100` each yield `INVALID_SLIPPAGE` with **zero** network calls
(asserted against a client that throws if invoked at all); the boundary `15` is accepted;
`fromChainId !== toChainId` and an unsupported chain (including Sepolia specifically) both
fail locally with zero network calls; a token missing from the chain's list — tried for both
`fromToken` and `toToken`, on two chains never touched by an earlier case — fails with
`UNSUPPORTED_TOKEN` and never reaches `getQuote`; the happy path sends `"0.001"` parsed at 18
decimals as the wire string `"1000000000000000"`, the omitted slippage reaches the wire as the
fraction `0.005`, and `expiresAt` lands 30 000 ms ± ~1 ms after the call.
`chain` — a live USDC→USDT quote on Base: `fromAmount` is exactly `5000000n` for input `"5"`
at USDC's 6 decimals, `toAmountMin < toAmount`, output token metadata reads `USDT`/6, a real
spender and route come back, `expiresAt` lands 30 s out.

**Two things the fixture runs caught that are worth recording**, both fixed in the test, not
the implementation: `fetchTokens`'s process-lifetime cache (T-5, R-1) means re-using a chain id
across fixture cases with different token lists silently serves the first case's cached
result — the UNSUPPORTED_TOKEN cases had to run on chain ids untouched by any earlier case in
the same process. And the wire request built by `lifiClient` carries `fromAmount` as a decimal
**string** and slippage as the field `slippage` (a fraction), not `slippagePercent` as a
`bigint` — asserting against the wrong shape produced false failures on an implementation that
was already correct.
**Depends on:** T-1..T-5

### [x] T-8 · `buildSwapApprovalTxs`
**File:** `src/swap/buildSwapApprovalTxs.ts` (new), `src/index.ts`
**Satisfies:** SDK-13, SDK-14, SDK-15, SDK-16, SDK-17, SDK-18, FC-4 · **Plan:** D-7

Returns `TransactionRequest[]` of length 0, 1 or 2:

| Condition | Result | Clause |
|---|---|---|
| input is native | `[]` | SDK-14 |
| allowance ≥ amount | `[]` | SDK-15 |
| allowance == 0 | `[approve(spender, MaxUint256)]` | SDK-16 |
| 0 < allowance < amount | `[approve(spender, 0), approve(spender, MaxUint256)]` | SDK-17 |

Every transaction is addressed to the input token contract (SDK-18) and its spender comes from
`quote.spender` (SDK-4). **Nonces are read once and assigned sequentially** `n`, `n+1` in list
order — preparing both in the same tick would otherwise give both the same pending nonce and
the second would be rejected as a replacement (D-7). Implemented as: `prepareTransaction` for
the reset-to-zero transaction (its one internal `getTransactionCount` call is the single nonce
read), then `estimateTransaction` for the unlimited approval — which does not touch the nonce
at all — with the transaction assembled by hand using `preparedReset.nonce + 1`. Exported from
`src/index.ts` (standing rule, D-11).

**Verify** `pure` — 15 cases via an injected fake allowance reader (everything else — nonce,
gas, fee — hits live Base RPC, so the nonce arithmetic is verified against a real reading, not
a second mock): native input returns `[]` **and never calls the allowance reader at all**
(SDK-14); allowance equal to or above the amount returns `[]`, with the reader confirmed
called first (SDK-13, SDK-15); zero allowance returns exactly one transaction, decoded to
confirm it is `approve(spender, MaxUint256)` addressed to the input token, not the spender
(SDK-16, SDK-18); an allowance strictly between zero and the amount returns exactly two
transactions, decoded to confirm `approve(spender, 0)` then `approve(spender, MaxUint256)` in
that order, **with `nonce[1] === nonce[0] + 1`** against a fresh wallet's real nonce (SDK-17,
D-7).

**The bug D-7 exists to prevent was reproduced directly**, not just assumed from the writeup:
calling `prepareTransaction` independently for two transactions in the same tick — the naive
approach this function deliberately avoids — was run against live Base RPC and returned
`nonce: 0` for **both**, confirming the second would have been rejected as a replacement had
both been broadcast.
`chain` — the native case and the already-approved case both return `[]` on Base (covered by
the same live-RPC run above, since only the allowance reader was mocked).
**Depends on:** T-4, T-6, T-7

### [x] T-9 · Extend `TxStatusResponse`
**Files:** `src/blockchain/txStatus.ts`, `src/types/common.ts`
**Satisfies:** SDK-24 · **Plan:** D-8

Add `status: 'pending' | 'success' | 'failed'` alongside the existing `success: boolean`, whose
semantics do not change. No receipt → `pending`; `receipt.status !== 1` → `failed`; `=== 1` →
`success`. The existing `catch` branch keeps returning `pending`.

Both are shared files predating this feature — `TxStatusResponse`/`txStatus` already served
transfers before swaps existed. No whole-file traceability header was added (it would
misrepresent the file's scope); instead a single-line `// Satisfies SDK-24` sits next to the
status derivation, per CLAUDE.md's clause-traceability exception. No barrel change: both were
already public before this task: the `status` field is additive to an already-exported type.

**Verify** `review` — grepped the codebase for other readers of `.success`; none exist outside
this file (the two hits elsewhere are on an unrelated `Multicall3Result` shape). The field is
purely additive.
`chain` — against real Base data, not fabricated hashes: pulled a genuinely successful and a
genuinely reverted transaction out of a live recent block via `getBlock(..., true)` +
`getTransactionReceipt`, rather than guessing hashes by hand. Confirmed tx → `status:
"success"`, `success: true`; reverted tx → `status: "failed"`, `success: false`, receipt still
present either way; a syntactically valid but never-mined hash → `status: "pending"`,
`receipt: null`; an unreachable RPC host → the `catch` branch still reports `status:
"pending"`. **9/9 passed.**
**Depends on:** —

### [x] T-10 · `resolveSwapState`
**File:** `src/swap/resolveSwapState.ts` (new), `src/index.ts`
**Satisfies:** SDK-25, SDK-26, SDK-27, SDK-28, SDK-29, SDK-30, SDK-31, FC-8, FC-9, FC-10
**Plan:** D-9

Pure function over `{ phase, outcome }` implementing D-9's eight-cell table. No `Date`, no
provider, no module-level mutable state — SDK-25 makes each of those a defect. Exported from
`src/index.ts` (standing rule, D-11).

**Verify** `pure` — 17 assertions, all passing: all eight `phase × outcome` cells match D-9's
table exactly (2 phases × 4 outcomes = 8, confirmed exhaustive, not just the rows the table
happens to list); `done` is produced by exactly one cell (SDK-29, FC-10); `pending` never
yields `done` or `error` in either phase (SDK-31); `failed` always yields `error` regardless of
phase (SDK-30); 1000 identical calls return identical output (purity); exactly 5 distinct
states are reachable across the whole domain (FC-8). SDK-25's "no clock" requirement was
checked empirically, not by inspection alone: `Date.now` was monkey-patched to throw if
touched, and the function still resolved correctly, proving it never reads the clock.
**Depends on:** T-1

### [x] T-11 · `buildSwapTx`
**File:** `src/swap/buildSwapTx.ts` (new), `src/index.ts`
**Satisfies:** SDK-19, SDK-20, SDK-21, SDK-22, SDK-23 · **Plan:** D-3

Ordered gates, cheapest first:

1. `Date.now() >= quote.expiresAt` → `QUOTE_EXPIRED` (SDK-20)
2. not native and allowance < `fromAmount` → `INSUFFICIENT_ALLOWANCE` (SDK-21)
3. `provider.estimateGas` as the revert gate: `CALL_EXCEPTION` → `EXECUTION_REVERTED`, network
   failure → `PROVIDER_ERROR` (SDK-23, D-3). Its numeric result is discarded.
4. Compose the transaction: `to`/`data`/`value` from the quote (SDK-19); nonce from
   `getTransactionCount(from, 'pending')`; fees from `fetchFeeSnapshot`; **gas limit from
   `quote.raw.gasLimit` plus a flat 5%**, falling back to the gate's own estimate plus the same
   5% when the quote carries none (SDK-22, D-3).

Returns `PrepareTransactionResult` with `bufferPercentage: 5` and `gasReserve` recomputed from
that limit. `prepareTransaction` is deliberately not used here — its dynamic 5-30% buffer would
compute a limit we discard, at the cost of a second `estimateGas` (D-3).

Exported from `src/index.ts` (standing rule, D-11).

**Two gaps in D-3 found while implementing, both resolved in the file with the reasoning
recorded next to the code:**

- **`INSUFFICIENT_FUNDS` is a distinct ethers code**, neither revert-shaped nor an
  infrastructure fault, so D-3's two-way split did not cover it. Mapped to
  `EXECUTION_REVERTED`: reporting it as `PROVIDER_ERROR` would invite the consumer to retry an
  operation that cannot succeed. Balance remains the consumer's responsibility (FC-14); this is
  a defensive catch, not a balance check. `UNPREDICTABLE_GAS_LIMIT` is mapped the same way for
  nodes that still emit it.
- **`fetchFeeSnapshot` types its fee fields as `bigint | string` and throws a plain `Error`**
  when the node returns no usable fee data. Left unhandled, that untyped error would escape a
  swap operation and violate SDK-32. Both are normalized in a local `readFeeData` wrapper —
  fields to `bigint`, failure to `PROVIDER_ERROR`.

**Verify** `pure` — 18 fixture cases, all passing: an expired quote yields `QUOTE_EXPIRED` with
**zero** network calls, and `expiresAt === Date.now()` is treated as expired (the `>=`
boundary); an insufficient allowance yields `INSUFFICIENT_ALLOWANCE` and the simulation never
runs; a native input skips the allowance read entirely; `CALL_EXCEPTION`, `INSUFFICIENT_FUNDS`
and `UNPREDICTABLE_GAS_LIMIT` each yield `EXECUTION_REVERTED` while `NETWORK_ERROR`, `TIMEOUT`
and `SERVER_ERROR` each yield `PROVIDER_ERROR`; `to`/`data`/`value` come from the quote
(SDK-19); nonce and bigint fee data are resolved (SDK-22); `gasReserve = gasLimit *
maxFeePerGas`. On sizing: a quote `gasLimit` of `200000n` produces exactly `210000n` and the
gate's own `150000n` estimate is confirmed **discarded** (the result is not `157500n`), while a
quote carrying no `gasLimit` falls back to the gate estimate under the same 5% —
`150000n → 157500n`.

**D-3's central claim was proven against live Base, not assumed.** The same
guaranteed-to-revert call was put through both paths: `estimateGasLimitFromProvider` swallowed
it and returned a signable `gasLimit: 100000n` with `fallbackUsed: true`, while `buildSwapTx`
refused it with `EXECUTION_REVERTED`. That is the transaction a user would otherwise have
signed and burned the full limit on.
`chain` — end-to-end swap execution covered by T-15.
**Depends on:** T-4, T-5, T-6, T-7

---

## Integration

### [x] T-12 · Audit the public export surface
**File:** `src/index.ts`
**Satisfies:** FC-1, FC-11, FC-12, FC-17 · **Plan:** D-4, D-11

Each preceding task already exported its own symbols under the `/** swap exports */` block
(standing rule). This task confirms the result is complete and contains nothing more:

| Must be exported | From |
|---|---|
| `getSwapQuote` | `swap/getSwapQuote` |
| `buildSwapApprovalTxs` | `swap/buildSwapApprovalTxs` |
| `buildSwapTx` | `swap/buildSwapTx` |
| `resolveSwapState` | `swap/resolveSwapState` |
| `getSwapSupportedChainIds` | `constants/SWAP_SUPPORTED_CHAINS` |
| `SwapError`, `isSwapError` | `swap/SwapError` |
| `SwapState`, `SwapPhase`, `SwapTxOutcome`, `SwapErrorCode`, `SwapTokenInfo`, `SwapRouteSummary`, `SwapQuote`, `LifiTransactionRequest`, and the four parameter interfaces | `types/swap` |

Must **not** be exported: anything under `swap/internal/`, and `isSwapSupportedChain`.
Exporting `lifiClient` would make `@lifi/sdk` part of the public contract (D-11).

No edits were needed: every task from T-2 onward already added its own exports under the
standing rule, so this audit is a confirmation, not a batch of fixes.

**Verify** `review` — all 19 expected symbols (6 operations/values + 13 types, per the table
above) cross-checked one by one against `src/index.ts`: **19/19 present**. `grep -n
"internal/" src/index.ts`, `grep -n "isSwapSupportedChain" src/index.ts` and `grep -n "export
\*" src/index.ts` all return nothing. `grep -rln "@lifi/sdk" src/` returns exactly one file
(`swap/internal/lifiClient.ts`), confirming D-1's isolation held through every later task.
`yarn build` (full dual build) succeeded; `dist/index.d.ts` was checked for a declaration of
each of the 19 symbols — **19/19 present** — and contains no reference to `internal` or
`isSwapSupportedChain`.

Then, rather than trust the grep against source, **imported the built package exactly as a
consumer would** — `require('dist/cjs/index.js')` from outside the repo tree — and confirmed:
all 7 public operations/values resolve as functions from the bare entry point; four internal
symbols one level down the call graph (`isSwapSupportedChain`, `readAllowance`,
`isNativeTokenAddress`, `fetchQuote`) are `undefined` on the barrel object. **11/11 passed.**

**One structural fact surfaced during the audit, not a defect of this task.** `package.json`
ships `"files": ["dist"]`, and `tsc` compiles every file under `src/` regardless of whether
`index.ts` re-exports it — so `dist/swap/internal/*.js` exist as physical files and are
deep-importable by path (`require('@octaflowlabs/onchain-sdk/dist/swap/internal/lifiClient')`),
even though nothing in `index.ts` references them. Confirmed this is not new: `dist/services`
and `dist/webhooks` are equally deep-importable and always have been — a property of how this
SDK has built and published since before this feature. "Not exported from the public barrel"
(true, verified above) is a narrower claim than "not present anywhere in the published tree"
(false, but pre-existing). Closing that gap would mean changing what `tsc`/`package.json`
publish for the *whole* SDK, which is outside this task's declared file scope (`src/index.ts`
only) and outside the plan's scope for 001.
**Depends on:** T-7..T-11

### [x] T-13 · Key-handling audit
**Files:** all of `src/swap/`
**Satisfies:** SDK-3, SDK-34, SDK-35 · **Plan:** D-5

Read the finished diff and confirm by absence: no parameter named for a key, mnemonic, signer
or wallet anywhere in the feature; no call to any signing routine; no new broadcast path
(SDK-34); `broadcastTransaction.ts` untouched apart from nothing (SDK-35). Grep for
`privateKey|mnemonic|signer|Wallet|signTransaction` under `src/swap/` and expect zero hits.

Audit-only task, like T-12: no source file created or edited, so there is no file to attach a
traceability header to. Findings recorded here instead.

The literal grep does **not** return empty — `walletAddress` matches `Wallet` as a substring 15
times, plus two doc-comment sentences using the plain-English word "wallet." Every hit was
inspected individually: all 15 code hits are the string parameter `walletAddress: string`
(exactly the shape SDK-3 requires — an address, never a `Wallet` instance or key), and both
prose hits are ordinary English, not a code reference. **Zero actual violations.**

The four public signatures were read directly rather than inferred from the grep: every
parameter across `GetSwapQuoteParams`, `BuildSwapApprovalTxsParams`, `BuildSwapTxParams` and
`ResolveSwapStateParams` is a primitive, a string-union phase/outcome, or the `SwapQuote` data
object — no `Signer`, `Wallet` or key-shaped type anywhere.

`broadcastTransaction.ts`: `git diff main -- src/blockchain/broadcastTransaction.ts` is empty —
confirmed untouched, not just assumed (SDK-35). No file under `src/swap/` calls
`sendTransaction` or any broadcast-shaped method (SDK-34).

**One additional structural check beyond what the task asked for:** every `ethers` `Contract`
or `Interface` use in `src/swap/` was inspected for what it's actually capable of, not just
grepped for signing keywords. `buildSwapApprovalTxs.ts`'s `Interface` only encodes calldata —
no provider or signer attached, so it cannot execute anything. `buildSwapTx.ts`'s
`provider.estimateGas` is a read-only simulation (`eth_estimateGas`), never
`sendTransaction`. `allowance.ts`'s `Contract` is bound to a `provider`, not a signer — calling
a state-changing method on it would throw at runtime, since there is nothing to sign with. This
is a stronger guarantee than the grep: even a mistaken call to a mutating method would fail
mechanically, not just violate a convention.

**Verify** `review` — grep hits classified individually (15 `walletAddress` substrings + 2
prose sentences, zero real matches); all four public signatures read directly; the
`broadcastTransaction.ts` diff confirmed empty; every `Contract`/`Interface` instance in
`src/swap/` confirmed incapable of executing a transaction by construction.
**Depends on:** T-12

### [x] T-14 · Document the public surface
**File:** `README.md`
**Satisfies:** FC-1 – FC-16 · **Plan:** public surface, consumer flow

New "Swaps" section following the existing table format. Must state explicitly, because a
consumer cannot infer them from the signatures:

- **FC-15** — a quote does not survive an approval; re-quote after `approved`
- **FC-10** — no balance update before `done`
- **FC-4** — the approval list may hold two transactions, broadcast in order, each confirmed
- **FC-11** — two error shapes across a full flow: `SwapError` from the swap operations,
  plain `Error` from `broadcastTransaction`
- **FC-16** — slippage is a percentage (`0.5` = 0.5%), default 0.5, bounded above 0 and ≤ 15

Like T-12/T-13, no traceability header applies — `README.md` isn't a new source file, so a
`<!-- Satisfies ... -->` HTML comment sits at the top of the new `### Swaps` section instead
(invisible when rendered, same intent as the JSDoc headers on every new `swap/` file).

All six signatures and the `SwapQuote` field list were **pulled from the built
`dist/*.d.ts`**, not copied from plan.md — the plan is a design-time artifact and could have
drifted from what T-1–T-11 actually shipped. Each was diffed individually: all six function
signatures match exactly (the README's `(params: XParams) => ...` simplification mirrors the
convention already used for every other entry, e.g. `getBalance`, which also destructures its
parameter in source); `SwapQuote`'s 12 fields match in name and order; `SwapErrorCode`'s 9
codes match in order.

**One gap found and fixed while writing this, not scoped to T-14 but surfaced by it:** the
existing `txStatus` row didn't mention `TxStatusResponse.status` at all (added in T-9) — so the
new Swaps section's own claim that "the caller supplies the outcome by polling `txStatus`"
would have been unverifiable by a reader with no visible source for `outcome`. Fixed both the
`txStatus` row and the `resolveSwapState` row to state exactly where each `SwapTxOutcome` value
comes from: `'not-submitted'` is caller-supplied before anything is sent; the other three are
`TxStatusResponse.status` after polling.

**Verify** `review` — every documented signature matches the emitted `.d.ts`, checked against
the built output rather than the plan. All five required call-outs are present: FC-15
(re-quote after `approved`), FC-10 (no balance update before `done`), FC-4 (two-transaction
approval list, ordered, sequential nonces), FC-11 (two error shapes: `SwapError` vs.
`broadcastTransaction`'s untyped `Error`), FC-16 (slippage as percentage, default 0.5, bounds
0 < x ≤ 15).
**Depends on:** T-12

### [x] T-15 · On-chain verification run
**Files:** none (records land in this file)
**Satisfies:** SDK-19, SDK-20, SDK-22, SDK-23, SDK-24, SDK-29 end to end
**Plan:** verification approach

Executed from a separate test repo (`wallet-broadcasting`) that symlinks the built package,
using the SDK's own `signTransaction` + `broadcastTransaction` exports to sign and submit —
not a script this repo owns. Chains actually used were **Ethereum mainnet (1) and Arbitrum
(42161)**, not Base/Scroll as originally suggested; kept as-is rather than forced onto the
originally-listed chains; gas cost was negligible (~$0.10 on the mainnet swap) and the
evidence is arguably stronger for having run on the most liquid, most adversarial chain in the
supported set, not just a quiet L2.

| # | Scenario | Chain | Pair | Amount | Tx hash(es) | Result |
|---|---|---|---|---|---|---|
| 1 | native → ERC-20, zero approvals | Arbitrum (42161) | ETH → USDC | 0.00055 ETH | swap `0xd75fc0a185a32602fb4a2bb0ec0187d2c9d4012df86d2a8f15a59d27c960ee9f` | `status: 1`, ~1.0326 USDC received |
| 2 | ERC-20 → native, first time (approval + mandatory re-quote) | Ethereum (1) | USDT → ETH | 3.8 USDT | approval `0x548b2f94003c5c9545fce524cd3a12cabfeab922f9d9bd52c8a488bc5c51a569` (nonce 9); swap `0xe7bcac982064a088e494a4c4ee343bc3c2fe004d648aa4f56cc3de55b4b1ed87` (nonce 10, fresh quote ~12 min after the approval) | both `status: 1` |
| 3 | same pair repeated, zero approvals | Ethereum (1) | USDT → ETH | 3.8 USDT | `buildSwapApprovalTxs` → `[]`, confirmed against real on-chain allowance | see note below |
| 4 | quote held past 30 s → `QUOTE_EXPIRED` | Arbitrum (42161) | ETH → USDC | 0.00055 ETH | none — rejected before any transaction was built | `SwapError QUOTE_EXPIRED`, `details.expiresAt` matched the quote's own field exactly |

Amounts and pair used ERC-20 ↔ native rather than ERC-20 ↔ ERC-20 as originally scripted; this
is a fine substitution — SDK-16/SDK-14 are exercised by whichever side of the pair is the
ERC-20, and the native side genuinely has no approval concept to test around.

**Scenario 4 detail worth keeping:** two quotes were fetched back-to-back (`quote`, `quote2`,
`expiresAt` 437ms apart), the wait was computed off the *later* one's expiry, but `buildSwapTx`
was called with the *earlier* one. The thrown error's `details.expiresAt` matched the earlier
quote's own field exactly — confirming the gate reads `quote.expiresAt` off the specific object
passed in, not a shared or global timer.

**Unplanned but valuable evidence, found in the raw logs, not engineered for:**

- **Scenario 2's first attempt hit `INSUFFICIENT_ALLOWANCE` live**, before the approval was
  ever broadcast — the consumer tried `buildSwapTx` right after building (not sending) the
  approval. `SwapError { code: 'INSUFFICIENT_ALLOWANCE', details: { allowance: 0n, required:
  3800000n } }`, zero gas spent. Real confirmation of SDK-21's gate, not staged.
- **The 5% gas buffer's exact bigint arithmetic (D-3) checks out against two independent real
  quotes:** `841135 → 883191` (Ethereum) and `3420840 → 3591882` (Arbitrum). Both equal
  `gasLimit + (gasLimit * 5n) / 100n` precisely.
- **D-3's central claim — that the local simulation gate must not be trusted for sizing — is
  now confirmed in production, not just against a synthetic fixture (T-11).** In both real
  swaps, `gasEstimated` (the local gate's own reading, discarded for sizing) came in far below
  the LI.FI-derived `gasLimit` actually used: `492243` vs `883191` on Ethereum, `490873` vs
  `3591882` on Arbitrum — a 7× gap on Arbitrum. Sizing off the local estimate would have
  underfunded both transactions.

**Scenario 3 caveat, stated plainly rather than overclaimed:** the empty-approval-list check
and the swap execution both happened inside the same run (3), not as two independently
completed swaps of the same pair. SDK-15 (sufficient allowance → empty list) is genuinely
verified against real on-chain allowance state; a second, fully separate repeat swap was not
additionally run, and spending more real gas purely for that separation wasn't judged worth it.

The two-transaction USDT reset path (SDK-17) is not exercised here — provoking a partial
non-zero allowance on purpose costs a transaction to set up and one to undo. It stays verified
against a mocked allowance in T-8.

**Verify** `chain` — all 4 scenarios recorded with real hashes, receipts, or (scenario 4)
the exact rejected-quote detail. **4/4 done.**
**Depends on:** T-12

### T-16 · Release 1.7.0
**File:** `package.json`
**Satisfies:** — · **Plan:** target release

Bump `1.6.0` → `1.7.0`. Minor, not patch: the surface grows and `TxStatusResponse` gains a
field (T-9). Run `yarn prettier`, then `yarn build`, and confirm both the ESM and CJS outputs
plus declarations before publishing.

**Verify** `review` — `dist/index.d.ts` exports the full swap surface; `dist/cjs` builds.
**Depends on:** T-13, T-14, T-15

---

## Clause coverage

Every clause in spec.md maps to at least one task.

| Clause | Task |
|---|---|
| SDK-1, SDK-2 | T-1, T-7 |
| SDK-3 | T-13 |
| SDK-4 | T-5, T-8 |
| SDK-5, SDK-6 | T-5, T-7 |
| SDK-7, SDK-8 | T-3, T-7 |
| SDK-9, SDK-10 | T-7 |
| SDK-13 | T-6, T-8 |
| SDK-14 | T-4, T-8 |
| SDK-15, SDK-16, SDK-17, SDK-18 | T-8 |
| SDK-19, SDK-20, SDK-21, SDK-22, SDK-23 | T-11 |
| SDK-24 | T-9 |
| SDK-25 – SDK-31 | T-10 |
| SDK-32 | T-2 |
| SDK-33 | T-5, T-6, T-11 |
| SDK-34, SDK-35 | T-13 |
| SDK-36, SDK-37, SDK-38 | T-5, T-7 |
| FC-1 | T-12, T-14 |
| FC-2, FC-3, FC-5 | T-8, T-11, T-14 |
| FC-4 | T-8, T-14 |
| FC-6 | T-1, T-7 |
| FC-7, FC-15 | T-7, T-14, T-15 |
| FC-8, FC-9, FC-10 | T-10, T-14 |
| FC-11 | T-2, T-14 |
| FC-12 | T-3, T-12 |
| FC-13 | T-7 |
| FC-14 | T-14 |
| FC-16 | T-5, T-7, T-14 |
| FC-17 | every task that creates public surface; audited by T-12 |

**Frontend repo** — the consuming plan references this document's `§Frontend contract` items by
id, e.g. `refs sdk-spec §Frontend contract, FC-4`. The spec is not duplicated there.
