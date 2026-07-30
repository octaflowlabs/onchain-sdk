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

### T-8 · `buildSwapApprovalTxs`
**File:** `src/swap/buildSwapApprovalTxs.ts` (new)
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
the second would be rejected as a replacement (D-7). Gas via `prepareTransaction` with
`GAS_LIMIT_PER_TX_TYPE.DEFAULT_APPROVAL` as the floor.

**Verify** `pure` — the four rows above against a mocked allowance reader, asserting list
length, ordering, target address, and that the two-element case carries `n` and `n+1`.
`chain` — the native case and the already-approved case both return `[]` on Base.
**Depends on:** T-4, T-6, T-7

### T-9 · Extend `TxStatusResponse`
**Files:** `src/blockchain/txStatus.ts`, `src/types/common.ts`
**Satisfies:** SDK-24 · **Plan:** D-8

Add `status: 'pending' | 'success' | 'failed'` alongside the existing `success: boolean`, whose
semantics do not change. No receipt → `pending`; `receipt.status !== 1` → `failed`; `=== 1` →
`success`. The existing `catch` branch keeps returning `pending`.

**Verify** `review` — no existing reader of `success` is touched; the field is additive.
`chain` — a confirmed tx reports `success`, a reverted one reports `failed`, and one polled
immediately after broadcast reports `pending`.
**Depends on:** —

### T-10 · `resolveSwapState`
**File:** `src/swap/resolveSwapState.ts` (new)
**Satisfies:** SDK-25, SDK-26, SDK-27, SDK-28, SDK-29, SDK-30, SDK-31, FC-8, FC-9, FC-10
**Plan:** D-9

Pure function over `{ phase, outcome }` implementing D-9's eight-cell table. No `Date`, no
provider, no module-level mutable state — SDK-25 makes each of those a defect.

**Verify** `pure` — all eight cells against their expected state; `done` is produced by exactly
one cell (SDK-29, FC-10); calling twice with identical inputs returns identical output.
**Depends on:** T-1

### T-11 · `buildSwapTx`
**File:** `src/swap/buildSwapTx.ts` (new)
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

**Verify** `pure` — an expired quote yields `QUOTE_EXPIRED` and makes no network call; a mocked
insufficient allowance yields `INSUFFICIENT_ALLOWANCE`; a mocked `CALL_EXCEPTION` yields
`EXECUTION_REVERTED` while a mocked timeout yields `PROVIDER_ERROR`; the returned limit equals
`gasLimit * 1.05`. `chain` — covered by T-15.
**Depends on:** T-4, T-5, T-6, T-7

---

## Integration

### T-12 · Audit the public export surface
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

**Verify** `review` — every row above resolves from a bare `import { x } from '../dist'`;
`grep -r "internal/" src/index.ts` returns nothing; `yarn build` emits a declaration for each
listed symbol and none for the internals.
**Depends on:** T-7..T-11

### T-13 · Key-handling audit
**Files:** all of `src/swap/`
**Satisfies:** SDK-3, SDK-34, SDK-35 · **Plan:** D-5

Read the finished diff and confirm by absence: no parameter named for a key, mnemonic, signer
or wallet anywhere in the feature; no call to any signing routine; no new broadcast path
(SDK-34); `broadcastTransaction.ts` untouched apart from nothing (SDK-35). Grep for
`privateKey|mnemonic|signer|Wallet|signTransaction` under `src/swap/` and expect zero hits.

**Verify** `review` — the grep returns nothing, and the four public signatures are inspected
one by one.
**Depends on:** T-12

### T-14 · Document the public surface
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

**Verify** `review` — every documented signature matches the emitted `.d.ts`.
**Depends on:** T-12

### T-15 · On-chain verification run
**Files:** none (records land in this file)
**Satisfies:** SDK-19, SDK-20, SDK-22, SDK-23, SDK-24, SDK-29 end to end
**Plan:** verification approach

Four scenarios on a low-cost mainnet — Base or Scroll preferred, Optimism or Linea acceptable:

| # | Scenario | Confirms |
|---|---|---|
| 1 | native → ERC-20 (e.g. ETH→USDC) | empty approval list, flow starts at `approved` (SDK-14, FC-8) |
| 2 | ERC-20 → ERC-20, first time | full approval path plus the mandatory re-quote (SDK-16, FC-15) |
| 3 | same pair as #2, repeated | empty approval list from the unlimited allowance (SDK-15) |
| 4 | quote deliberately held past 30 s | `QUOTE_EXPIRED`, no transaction produced (SDK-20) |

Record chain, pair, amount, tx hashes, observed states and the final `done` for each. Scenario
2 is the one that proves FC-15 empirically: note the elapsed time between quote and `approved`.

The two-transaction USDT reset path (SDK-17) is not exercised here — provoking a partial
non-zero allowance on purpose costs a transaction to set up and one to undo. It stays verified
against a mocked allowance in T-8.

**Verify** `chain` — all four scenarios recorded with hashes.
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
