# 001 — Implementation plan

Technical decisions for [spec.md](./spec.md). Every decision cites the clauses it serves.
Where this document and the spec disagree, the spec wins.

**Target release:** `@octaflowlabs/onchain-sdk` **1.7.0** (minor: additive surface plus one
additive field on a published type).

---

## Decisions

### D-1 — Use `@lifi/sdk@3.1.5`, data-fetching half only *(SDK-5, SDK-6, SDK-7, SDK-10)*

The package is added as a runtime dependency, pinned to the **exact** version `3.1.5` — no
caret. Three functions are used and no others:

| Function | Wraps | Use | Clauses |
|---|---|---|---|
| `getQuote` | `GET /v1/quote` | route + priced offer + ready calldata | SDK-5, SDK-6 |
| `getTokens` | `GET /v1/tokens` | token support per chain | SDK-10 |
| `getChains` | `GET /v1/chains` | build-time verification of the chain list | SDK-7 |

`executeRoute` and every execution path stay unreachable — the SDK never signs (SDK-3), so the
package is used purely as a typed HTTP client. `getQuote` returns `transactionRequest`, which
is the unsigned transaction the consumer signs; this is the same shape the REST endpoint
returns, and the same one used in the team's prior production integration.

No API key exists for LI.FI and none is required, and **`createConfig` is not called**. Its job
is to install SDK-level defaults — execution providers, RPC endpoints, api key — none of which
apply when the `QuoteRequest` is built by hand and no route is ever executed. This matches the
team's prior production integration, which ran without it. Attribution rides on the request
object instead: `integrator` is a parameter of `/v1/quote` itself, so it goes on the same
hand-built object. It carries no secret and is safe in a client bundle. Confirm the exact field
name against `QuoteRequest` when the package is installed.

**Accepted cost.** The package brings `viem ^2.19.3`, `@solana/web3.js ^1.95.2`,
`@solana/wallet-adapter-base ^0.9.23`, `@lifi/types` and `eth-rpc-errors` as transitive
dependencies. They install regardless of what we import, taking this SDK from one runtime
dependency to six trees. That is supply-chain surface in a package that handles user funds, and
bundler tree-shaking does not reduce it — `yarn install` still fetches and runs their install
scripts. Chosen deliberately in exchange for implementation speed and for not owning the
response types. Two mitigations, both cheap:

- **Pin `3.1.5` exactly**, so a compromised publish inside a caret range cannot arrive silently.
- **T-13's audit** confirms nothing signing-related is reachable from our code, which bounds the
  blast radius to what any dependency could already do at install time.

Module format verified: 3.1.5 ships both CJS (`src/_cjs`) and ESM (`src/_esm`) behind a proper
`exports` map, so the existing dual build (`tsconfig.json` + `tsconfig.cjs.json`) keeps working.

### D-2 — The supported-chain set is a static constant, verified against `/chains` *(SDK-7, SDK-8, FC-12)*

Resolving the intersection at runtime would put a network call in front of every quote and
create a startup failure mode for a list that changes a few times a year. `NETWORKS_REGISTRY`
is already hand-maintained here, so a static constant matches the existing convention.

Verified against `GET /v1/chains?chainTypes=EVM` (69 EVM chains) on 2026-07-28: **all 16
mainnets in `NETWORKS_REGISTRY` are supported by LI.FI.** Only Sepolia falls out.

```
1 Ethereum · 10 Optimism · 56 BSC · 100 Gnosis · 130 Unichain · 137 Polygon · 999 HyperEVM
5000 Mantle · 8453 Base · 9745 Plasma · 42161 Arbitrum · 43114 Avalanche · 59144 Linea
80094 Berachain · 81457 Blast · 534352 Scroll
```

Lives in `src/constants/SWAP_SUPPORTED_CHAINS.ts`, exported as `getSwapSupportedChainIds()`
so consumers read it rather than maintaining their own (FC-12). A comment records the
verification command and date; refreshing it is a manual step when a chain is added to the
registry.

### D-3 — Simulate locally as a gate, size the limit from LI.FI + 5% *(SDK-22, SDK-23, SDK-33)*

Two separate concerns that the existing code conflates: **detecting that a swap would revert**,
and **choosing its gas limit**. This feature answers them from different sources.

**The revert gate.** `estimateGasLimitFromProvider` catches a reverting `estimateGas` and
returns `fallbackUsed: true` with `defaultGasLimit` instead of failing
([estimateGasLimitFromProvider.ts:72-93](../../src/blockchain/estimateGasLimitFromProvider.ts#L72-L93)).
For a transfer that is a reasonable cushion; for a swap it would hand back a signable
transaction guaranteed to revert and burn the whole limit. So `buildSwapTx` calls
`provider.estimateGas` itself, first, and interprets the failure:

- ethers `CALL_EXCEPTION` (or any revert-shaped failure) → `SwapError('EXECUTION_REVERTED')`
- network / timeout / malformed response → `SwapError('PROVIDER_ERROR')`
- success → proceed

`fallbackUsed` is deliberately not used for this: it conflates a revert with an unreachable
node, and those must map to different codes.

**The limit.** `transactionRequest.gasLimit` from the quote, plus a flat **5%** buffer. LI.FI
sizes it knowing the route's internal call graph — how many hops, which DEXes, which token
transfer semantics — none of which a single `estimateGas` reading generalises well across 16
chains. The 5% absorbs the drift between quote time and signing time. The value returned by
the gate's own `estimateGas` is discarded for sizing; it is consumed only as a yes/no on
reverting.

IF the quote carries no `gasLimit`, THEN the gate's own estimate is used with the same 5%
buffer, so the flat-buffer rule holds either way.

**Consequence: `prepareTransaction` is not reused for swaps.** Its whole job is to produce a
gas limit via the dynamic 5-30% congestion buffer, and that number is now discarded — calling
it would mean a second `estimateGas` round-trip whose result is thrown away. `buildSwapTx`
composes the three pieces it actually needs: nonce from `getTransactionCount(from, 'pending')`,
fee data from the existing `fetchFeeSnapshot`, and the limit above. It still returns the
established `PrepareTransactionResult` shape, with `bufferPercentage: 5` and `gasReserve`
recomputed from the LI.FI-derived limit. Approvals are unaffected and keep using
`prepareTransaction` (D-7).

### D-4 — Files live in `src/swap/`, types in `src/types/swap.ts`

```
src/swap/
  getSwapQuote.ts            SDK-5..10, SDK-36..38
  buildSwapApprovalTxs.ts    SDK-13..18
  buildSwapTx.ts             SDK-19..23
  resolveSwapState.ts        SDK-25..31
  SwapError.ts               SDK-32
  internal/lifiClient.ts     D-1, error mapping
  internal/allowance.ts      SDK-13, SDK-21
  internal/nativeToken.ts    SDK-14
src/constants/SWAP_SUPPORTED_CHAINS.ts
src/types/swap.ts
```

A dedicated folder mirrors `src/blockchain/` and `src/services/`. Types go in their own
`src/types/swap.ts` rather than `common.ts` — that file is already 215 lines of unrelated
transfer/fee types, and `getTokenMetadata.ts` sets the precedent that a feature may own its
types. Everything is re-exported from `src/index.ts` in the existing explicit-barrel style.

### D-5 — `SwapError` is a thrown class, matching the SDK's existing throw convention *(SDK-32, SDK-35, FC-11)*

```ts
export class SwapError extends Error {
  readonly code: SwapErrorCode
  readonly details?: unknown
  constructor(code: SwapErrorCode, message: string, details?: unknown)
}
export const isSwapError = (e: unknown): e is SwapError => e instanceof SwapError
```

The whole SDK throws today; a `Result` type for one feature would be the odd one out. `code`
is the branch point, `message` is developer-facing and never user-facing copy (FC-11).
`details` carries the raw upstream payload for debugging.

`broadcastTransaction` is left untouched (SDK-35), so a full swap flow raises `SwapError` from
the four swap operations and plain `Error` from submission. `isSwapError` is exported so
consumers can discriminate without `instanceof` across a bundle boundary.

**Code assignment:**

| Code | Raised by | Trigger |
|---|---|---|
| `INVALID_SLIPPAGE` | `getSwapQuote` | tolerance ≤ 0 or > 15, before any network call |
| `CROSS_CHAIN_NOT_SUPPORTED` | `getSwapQuote` | `fromChainId !== toChainId`, before any network call |
| `UNSUPPORTED_CHAIN` | `getSwapQuote` | chain id not in `SWAP_SUPPORTED_CHAINS` |
| `UNSUPPORTED_TOKEN` | `getSwapQuote` | token absent from `/tokens` for that chain |
| `NO_ROUTE` | `getSwapQuote` | HTTP 404, or 200 with no `transactionRequest` |
| `QUOTE_EXPIRED` | `buildSwapTx` | `Date.now() >= quote.expiresAt` |
| `INSUFFICIENT_ALLOWANCE` | `buildSwapTx` | on-chain allowance < `fromAmount` |
| `EXECUTION_REVERTED` | `buildSwapTx` | simulation reverts |
| `PROVIDER_ERROR` | any networked op | unreachable RPC / LI.FI, non-2xx other than 404, malformed body |

Order matters: cheap local validations first, network last. Nothing is spent to learn a
slippage value was malformed.

### D-6 — Native input is detected by address, never by symbol *(SDK-14)*

LI.FI represents a chain's native currency as `0x0000000000000000000000000000000000000000`.
Symbol-based detection breaks the moment the chain is not Ethereum or Polygon — BSC's `BNB`,
Avalanche's `AVAX` and Gnosis's `xDAI` would each be treated as an ERC-20 and sent to a
non-existent `approve`. Ten of our sixteen chains have a non-`ETH` native symbol.
`internal/nativeToken.ts` compares normalized addresses against the zero address, reusing
`normalizeEvmAddress`.

### D-7 — Approval transactions carry sequential nonces *(SDK-17, FC-4)*

The two-transaction reset path is the trap: both would be prepared in the same tick, and
`prepareTransaction` reads `getTransactionCount(from, 'pending')`, so both would receive the
same nonce and the second would be rejected as a replacement.

`buildSwapApprovalTxs` therefore reads the nonce once and assigns `n` and `n + 1` explicitly,
in list order. FC-4's rule — broadcast in order, each confirmed before the next — is then a
correctness requirement, not just advice.

Gas limit per approval comes from `GAS_LIMIT_PER_TX_TYPE.DEFAULT_APPROVAL` as the fallback
floor; the live estimate is preferred when available. Unlike the swap, a failed approval
estimate is not fatal — 100 000 covers any ERC-20 `approve`.

### D-8 — `TxStatusResponse` gains a `status` field, `success` is untouched *(SDK-24)*

```ts
export interface TxStatusResponse {
  success: boolean                              // unchanged semantics
  status: 'pending' | 'success' | 'failed'      // new
  receipt: TransactionReceipt | null
}
```

`pending` when no receipt, `failed` on `receipt.status !== 1`, `success` on `1`. Adding a
field to a returned object breaks no existing reader, which is what makes 1.7.0 a minor.
The `catch` branch currently returns `{ success: false, receipt: null }` for an RPC failure —
that keeps reporting `pending`, and callers who need to distinguish an unreachable node get
`PROVIDER_ERROR` from the swap-side wrapper instead (SDK-33).

### D-9 — The state resolver is a pure function over two enums *(SDK-25, FC-8, FC-9)*

```ts
resolveSwapState({ phase, outcome }: { phase: 'approval' | 'swap'; outcome: SwapTxOutcome }): SwapState
```

`SwapTxOutcome = 'not-submitted' | 'pending' | 'success' | 'failed'`.

| phase | outcome | state | clause |
|---|---|---|---|
| `approval` | `pending` | `approving` | SDK-26 |
| `approval` | `success` | `approved` | SDK-27 |
| `approval` | `failed` | `error` | SDK-30 |
| `approval` | `not-submitted` | `approving` | SDK-31 |
| `swap` | `not-submitted` | `approved` | SDK-27 |
| `swap` | `pending` | `swapping` | SDK-28 |
| `swap` | `success` | `done` | SDK-29 |
| `swap` | `failed` | `error` | SDK-30 |

The three situations FC-8 folds into `approved` all land on the same row: a consumer with no
approval to do simply starts at `phase: 'swap'`, `outcome: 'not-submitted'`. No clock, no
network, no retained state (SDK-25). `done` is reachable from exactly one cell (SDK-29,
FC-10).

The consumer owns the phase and the transaction hashes (FC-9); the SDK never infers them.

### D-10 — Slippage is a percentage at the boundary, a fraction on the wire *(SDK-36, SDK-38, FC-16)*

Public input is `slippagePercent?: number`, where `0.5` means half a percent. LI.FI's
`slippage` parameter is a fraction, so `lifiClient` divides by 100 at the single point where
the request is built. Default `0.5` when omitted (SDK-36).

Validation runs before anything else (SDK-37): reject `≤ 0` and `> 15`. Zero is rejected
because it is not "maximum protection" — it makes nearly every route revert and reads to the
user as a broken swap.

### D-11 — The package entry point is the only import path *(FC-1, FC-17)*

Everything listed under §Public surface is re-exported from `src/index.ts` inside a
`/** swap exports */` block, following the barrel convention already in that file: every symbol
named explicitly, no `export *`, and types carrying the `type` modifier as
`fetchFeeSnapshot` and `getTokenMetadata` already do.

Nothing under `src/swap/internal/` is exported. `lifiClient`, `allowance` and `nativeToken` are
implementation detail, and exporting `lifiClient` in particular would drag `@lifi/sdk` into the
public contract — the consumer would then be coupled to a dependency D-1 deliberately treats as
swappable.

**Standing rule:** a task that creates public surface adds its own exports in the same change.
Deferring every export to one late task turns the barrel into bookkeeping that is easy to get
wrong, and leaves finished work unreachable in the meantime. T-12 therefore becomes a
completeness audit, not a batch of edits.

---

## Public surface

```ts
getSwapQuote(params: GetSwapQuoteParams): Promise<SwapQuote>
buildSwapApprovalTxs(params: BuildSwapApprovalTxsParams): Promise<TransactionRequest[]>
buildSwapTx(params: BuildSwapTxParams): Promise<PrepareTransactionResult>
resolveSwapState(params: ResolveSwapStateParams): SwapState
getSwapSupportedChainIds(): number[]
isSwapError(e: unknown): e is SwapError
```

Plus the types: `SwapQuote`, `SwapState`, `SwapPhase`, `SwapTxOutcome`, `SwapErrorCode`,
`SwapError`, `SwapTokenInfo`.

`SwapQuote` is the token the consumer holds between steps and hands back:

```ts
interface SwapQuote {
  fromChainId: number
  toChainId: number
  fromToken: SwapTokenInfo        // address, decimals, symbol
  toToken: SwapTokenInfo          // SDK-5
  fromAmount: bigint
  toAmount: bigint
  toAmountMin: bigint             // enforced by the calldata itself — see SDK-23
  slippagePercent: number
  spender: string                 // estimate.approvalAddress only — SDK-4
  expiresAt: number               // epoch ms, issued + 30 000 — SDK-5
  route: { tool: string; toolName: string; steps: number }
  raw: LifiTransactionRequest     // opaque; the source of to/data/value for SDK-19
}
```

Amounts enter as decimal strings and leave as `bigint` (SDK-1, SDK-2, FC-6). Conversion uses
the existing `parsedAmount` helper with the decimals of the token each amount denominates.

Naming note: the build functions are named for what they do. Nothing here signs or submits, so
nothing is named `execute` — a consumer who reads `executeSwap` and assumes the swap happened
is exactly the failure FC-10 exists to prevent.

---

## Flow the consumer implements

1. `getSwapQuote(...)` → `SwapQuote`
2. `buildSwapApprovalTxs({ quote, ... })` → `[]`, `[tx]` or `[reset, approve]`
3. If non-empty: sign each, `broadcastTransaction`, poll `txStatus`,
   `resolveSwapState({ phase: 'approval', outcome })` until `approved`
4. **Re-quote** (FC-15) — the approval outstayed the 30 s window, guaranteed
5. `buildSwapTx({ quote: freshQuote, ... })` → ready-to-sign transaction
6. Sign, `broadcastTransaction`, poll, `resolveSwapState({ phase: 'swap', outcome })`
7. `done` and only `done` releases a balance refresh (FC-10)

Steps 2-4 vanish when the input is native or an unlimited allowance already exists; the
consumer starts at step 5 with the original quote.

---

## Traceability

| Clause | Implemented in |
|---|---|
| SDK-1, SDK-2 | `types/swap.ts`, `parsedAmount` at each boundary |
| SDK-3 | absence — reviewed by signature inspection, no key/signer parameter anywhere |
| SDK-4 | `lifiClient.ts` maps `estimate.approvalAddress` → `SwapQuote.spender` |
| SDK-5, SDK-6 | `getSwapQuote.ts` |
| SDK-7, SDK-8 | `SWAP_SUPPORTED_CHAINS.ts` + guard in `getSwapQuote.ts` |
| SDK-9 | guard in `getSwapQuote.ts`, before any network call |
| SDK-10 | `/tokens` lookup in `getSwapQuote.ts` |
| SDK-13, SDK-15, SDK-16, SDK-17, SDK-18 | `buildSwapApprovalTxs.ts` + `internal/allowance.ts` |
| SDK-14 | `internal/nativeToken.ts` (D-6) |
| SDK-19, SDK-20, SDK-21, SDK-22, SDK-23 | `buildSwapTx.ts` (D-3) |
| SDK-24 | `blockchain/txStatus.ts` (D-8) |
| SDK-25 – SDK-31 | `resolveSwapState.ts` (D-9) |
| SDK-32, SDK-33 | `SwapError.ts` + mapping in `lifiClient.ts` (D-5) |
| SDK-34, SDK-35 | absence — no new broadcast path; `broadcastTransaction.ts` untouched |
| SDK-36, SDK-37, SDK-38 | `getSwapQuote.ts` validation + `lifiClient.ts` conversion (D-10) |
| FC-1 – FC-16 | the public surface above; FC-15 is consumer-side, documented in README |

---

## Verification approach

No test runner exists in this repo and none is introduced here. Each clause is verified one of
two ways, recorded per task in `tasks.md`:

- **Pure** — deterministic, no chain: the state table (D-9), slippage bounds, native detection,
  amount conversion, error-code selection, approval list shapes given a mocked allowance.
  Verified by direct invocation against a written expected value.
- **On-chain** — executed on a low-cost mainnet (Scroll, Base, Optimism or Linea) with real
  funds, recording chain, token pair, amount, tx hash and observed result.

The on-chain set worth spending gas on: a native→ERC-20 swap (no approval path), an
ERC-20→ERC-20 first-time swap (approval path plus the mandatory re-quote of FC-15), a repeat
swap of an already-approved token (empty approval list), and a deliberately expired quote.
The two-transaction USDT reset path is the one branch that is awkward to trigger deliberately;
it is verified against a mocked allowance rather than on-chain.

---

## Risks and open items

- **R-1 — `/tokens` on every quote.** SDK-10 needs the token list per chain. Fetching it each
  time adds a round-trip. Proposal: cache per chain id for the process lifetime; the list is
  effectively static. Not cached across sessions, no persistence introduced.
- **R-2 — 30-second expiry is ours, not LI.FI's.** LI.FI does not publish a hard expiry, so
  `expiresAt` is stamped locally at issue time. It is a policy, not an upstream guarantee; a
  quote may still be honoured after it, and may fail before it. SDK-23 is the real protection.
- **R-3 — FC-15 makes a two-approval swap need three quotes.** Acceptable, quotes are free and
  unauthenticated, but it is worth watching for rate limiting without an `integrator` string.
- **R-4 — HyperEVM and Plasma are supported by LI.FI but are thin markets.** Expect `NO_ROUTE`
  to be the common answer there rather than an error condition. Worth exercising before the
  frontend treats `NO_ROUTE` as exceptional.
