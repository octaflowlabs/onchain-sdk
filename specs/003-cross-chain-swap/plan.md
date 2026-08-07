# 003 — Implementation plan

Technical decisions for [spec.md](./spec.md). Every decision cites the clauses it serves.
Where this document and the spec disagree, the spec wins.

**Target release:** `@octaflowlabs/onchain-sdk` **1.9.0** — with one caveat about the retired error
code that is argued out in D-9 rather than waved through.

All upstream findings below were **measured against the live routing service on 2026-08-06**, not
inferred from documentation or from 001's notes. The probes and their raw answers are reproduced
where they change a decision.

---

## Decisions

### D-1 — `getStatus` comes from the already-installed `@lifi/sdk@3.1.5` *(CC-11, CC-21)*

No new dependency, no version change. `getStatus` is exported by the pinned 3.1.5 already in
`package.json`, and it is added to the single import line in
[lifiClient.ts:40](../../src/swap/internal/lifiClient.ts#L40), which stays the only file in the
codebase that imports from `@lifi/sdk` (001's D-1 and D-11). The adapter gains one function,
`fetchSettlement`; nothing execution-related becomes reachable.

Confirmed through the installed package, not by reading its types:

```
status(unknown hash) THREW: SDKError | cause= HTTPError | cause.status= 404
  | body= {"message":"Transaction hash '0xabab…' not found on chain '137'","code":1003}
```

The error shape is exactly the one 001's T-5 recorded for `getQuote` — `SDKError` wrapping an
`HTTPError` on `.cause`, carrying a numeric `.status` and a `.responseBody` of `{ message, code }`.
So the existing `httpStatusOf` and `upstreamMessageOf` helpers work unchanged for this endpoint.
`createConfig` is still not called, and `getStatus` still resolves `config.get().apiUrl` to the
public default.

### D-2 — The HTTP status decides `pending`, not the response body *(CC-13, CC-17, CC-21)*

This is the decision the whole operation turns on, and it is the one that a reasonable
implementation gets wrong by reusing what is already there.

**Measured, `GET /v1/status`:**

| Probe | HTTP | Body |
|---|---|---|
| well-formed hash the service does not know | **404** | `{"message":"Transaction hash is not found in any chain.","code":1003}` |
| same, scoped to `fromChain=137` | **404** | `{"message":"…not found on chain '137'","code":1003}` |
| malformed hash (`0xdeadbeef`) | **400** | `{"message":"/txHash Not a valid txHash","code":1011}` |
| a real EVM transaction that is not a routing-service transfer (an ERC-20 approval) | **400** | `{"message":"Not an EVM Transaction: Hash '0x548b…' on chain '1'","code":1011}` |
| a real transfer | **200** | `{ status, substatus, substatusMessage, sending, receiving, … }` |

`StatusMessage` declares `NOT_FOUND` as a member, but **the service does not deliver it in a 200
body** — an unknown hash is a 404 that the package throws. The mapping is therefore driven by the
HTTP status first and the `status`/`substatus` fields second:

| Upstream | Report | Clause |
|---|---|---|
| HTTP 404 (any code) | `pending` | CC-13 |
| HTTP 400 (any code) | `failed`, reason `not-recognized` | CC-17 |
| 200, `status: 'PENDING'` | `pending` | CC-13 |
| 200, `status: 'NOT_FOUND'` | `pending` | CC-13 |
| 200, `status: 'DONE'`, substatus `COMPLETED` or `PARTIAL` | `success` | CC-14 |
| 200, `status: 'DONE'`, substatus `REFUNDED` | `failed`, reason `refunded` | CC-15 |
| 200, `status: 'FAILED'` | `failed`, reason `execution-failed` | CC-16 |
| 200, `status: 'INVALID'` | `failed`, reason `not-recognized` | CC-17 |
| anything else — unreachable, non-2xx other than 400/404, unparseable, unknown `status` | `SwapError('PROVIDER_ERROR')` | CC-21 |

`NOT_FOUND` and `INVALID` are handled even though neither was observed in a 200: they are declared
members of the upstream union, and a defensive row costs nothing next to a silent fall-through into
`PROVIDER_ERROR` mid-swap.

**The trap this decision exists to avoid.** `fetchQuote` already maps a 404 to `NO_ROUTE`
([lifiClient.ts:124-129](../../src/swap/internal/lifiClient.ts#L124-L129)), which is correct there
and catastrophic here: a 404 from `/status` means *"I do not know that hash yet"*, which is the
answer for the first seconds of **every** cross-chain swap, right after the origin transaction is
broadcast. Reusing the quote path's error mapping would report `NO_ROUTE` on every swap the instant
it started. `fetchSettlement` therefore performs its own HTTP-status interpretation and shares no
error-mapping branch with `fetchQuote` — only the two shape-reading helpers, which carry no policy.

### D-3 — OQ-8 answered by measurement: the settlement report alone is authoritative *(CC-11, CFC-6)*

The spec left open what the routing service says about an origin transaction that reverted, and
required it to be measured rather than assumed. Two reverted transactions to the LI.FI diamond on
Base were located and confirmed reverted **on-chain first** (`eth_getTransactionReceipt` →
`status: 0x0`, blocks 49638658 and 49638676), then queried:

```
0x624a07cac6…  HTTP 200  {"status":"FAILED","sending":{"chainId":8453,"txHash":"0x624a…"}}
0x99fc934e8a…  HTTP 200  {"status":"FAILED","sending":{"chainId":8453,"txHash":"0x99fc…"}}
```

Identical with and without `fromChain`/`toChain`. The answer is the `FailedStatusData` variant:
`status: 'FAILED'`, `sending` present, **`receiving` absent**.

**Consequence: CFC-6's two-source rule can collapse to one source.** A consumer polling only
`getSwapSettlement` sees a reverted origin transaction as `failed` → `error`, with no need to poll
the origin receipt at all. The single-source form is a simplification, exactly as the spec
predicted, and it is what this plan implements and documents.

Two honest limits on that evidence, neither of which changes the decision:

- **The two reverted transactions were same-chain routing-service swaps**
  (`swapTokensMultipleV3ERC20ToERC20`), not bridges — no reverted bridge origin transaction turned
  up in the sampled window. The lookup path is the same one (find the transaction, read its
  receipt), and the `FAILED` answer does not depend on what the calldata was going to do, but this
  is evidence rather than proof. T-8 re-checks it against a real cross-chain hash.
- **A revert is reported as `pending` until the service indexes it.** Polling the origin receipt
  directly is strictly faster at detecting an origin-side failure. The contract does not need that
  speed, and buying it would put two sources of truth back into the consumer's loop for a case that
  resolves on its own within seconds.

### D-4 — Quoting, approval and construction need no code change at all *(CC-1, CC-7, CC-9, CC-10)*

Verified two ways rather than assumed, because "it already works" is the claim most worth
distrusting here.

**Measured — a live cross-chain quote, Polygon USDC → Base USDC, 2 USDC:**

```
tool: across (AcrossV4), includedSteps: 2, type: lifi
action:    fromChainId 137, toChainId 8453, toToken USDC @ chainId 8453, decimals 6
estimate:  approvalAddress 0x1231DEB6…4EaE, fromAmount "2000000",
           toAmount "1992210", toAmountMin "1992210"
transactionRequest: to 0x1231DEB6…4EaE, chainId 137, value "0x0", gasLimit "0xa8174"
```

The `Step` shape is identical to the same-chain one 001 already consumes: `transactionRequest` is
on the **origin** chain, `estimate.approvalAddress` is present, and `action.toToken` carries the
destination chain's token with the destination chain's decimals. So:

- **`fetchQuote` is unchanged.** It already forwards `fromChainId`/`toChainId` verbatim and maps
  `action.toToken` through `toTokenInfo`, so CC-7 — output amounts denominated in the destination
  token's own units — is satisfied by code that already exists. Nothing in it assumed equality.
- **`buildSwapApprovalTxs` is unchanged.** Every chain-dependent argument in it reads
  `quote.fromChainId` ([buildSwapApprovalTxs.ts:54-113](../../src/swap/buildSwapApprovalTxs.ts#L54-L113)):
  the allowance read, both `prepareTransaction` calls, the `estimateTransaction` call and the
  hand-assembled transaction's `chainId`. `toChainId` is never consulted.
- **`buildSwapTx` is unchanged.** Same property
  ([buildSwapTx.ts:122-158](../../src/swap/buildSwapTx.ts#L122-L158)): allowance, provider,
  simulation, nonce, fees and the returned `chainId` all come from `quote.fromChainId`.

CC-9 and CC-10 are therefore **satisfied by absence**, and their verification is an empty diff on
those two files — the same evidentiary standard 001's T-13 applied to `broadcastTransaction.ts`.

### D-5 — `getSwapQuote` changes in exactly four places *(CC-3, CC-4, CC-6, CC-28)*

The whole cross-chain surface of the quote path is four edits to one file, keeping 001's ordering
rule: cheap local checks first, network last, so nothing is spent to learn a local input was
malformed.

1. **Delete** the `fromChainId !== toChainId` guard
   ([getSwapQuote.ts:57-62](../../src/swap/getSwapQuote.ts#L57-L62)) — SDK-9 retired, CC-1.
2. **Add** the recipient guard in its place (CC-6): when the chains differ and `toAddress` is
   supplied and does not normalize equal to `fromAddress` → `UNSUPPORTED_RECIPIENT`, before any
   network call. Comparison goes through `normalizeEvmAddress`, so a checksum difference is not a
   rejection. Same-chain is untouched by this guard, which is what keeps CC-2 true: a same-chain
   swap to a different recipient still works exactly as it did in 1.8.0.
3. **Widen** the chain guard to both chains (CC-3): `isSwapSupportedChain(fromChainId)` **and**
   `isSwapSupportedChain(toChainId)`, with the failing chain id in `details`.
4. **Split** the token lookup (CC-4). Today both tokens are looked up in
   `fetchTokens(fromChainId)` ([getSwapQuote.ts:72-74](../../src/swap/getSwapQuote.ts#L72-L74)) —
   correct only while the chains were forced equal. It becomes
   `fetchTokensForChains([fromChainId, toChainId])`, the multi-chain reader **002 already built**
   (its D-4), with `fromToken` resolved against the origin chain's list and `toToken` against the
   destination chain's.

Edit 4 costs a same-chain swap nothing: `fetchTokensForChains` deduplicates its input
([lifiClient.ts:189](../../src/swap/internal/lifiClient.ts#L189)), so `[137, 137]` performs exactly
the one lookup `fetchTokens(137)` performs today, and 002's process-lifetime cache still serves the
second chain for free once it has been seen. `parsedAmount` keeps using the **origin** token's
decimals (SDK-2), which is where the input amount is denominated.

### D-6 — The settlement report is a returned value, and its outcome is a subtype of 001's *(CC-11, CC-18, CC-19, CC-30)*

```ts
export type SwapSettlementOutcome = Exclude<SwapTxOutcome, 'not-submitted'>
export type SwapSettlementReason = 'refunded' | 'execution-failed' | 'not-recognized'

export interface SwapSettlementReport {
  outcome: SwapSettlementOutcome
  reason?: SwapSettlementReason
  receivedAmount?: bigint
  receivedToken?: SwapTokenInfo
  destinationTxHash?: string
}
```

Two things this shape buys, both load-bearing:

**`SwapSettlementOutcome` is defined as `SwapTxOutcome` minus `not-submitted`, not as a fresh
union.** That makes `report.outcome` assignable to `ResolveSwapStateParams['outcome']` with no
conversion, no cast and no mapping table: the consumer writes
`resolveSwapState({ phase: 'swap', outcome: report.outcome })` and it type-checks. CFC-9's claim —
that the network access lives in an operation the consumer calls explicitly and the resolver stays
pure — becomes something the type system enforces rather than something the README asserts. And
`not-submitted` is excluded because it is meaningless here: settlement is only ever asked about a
transaction that has a hash, so including it would publish a fourth value that can never be
returned, which is the dead-member defect CC-28 and CC-30 exist to remove.

**The reason is a field, not a thrown code** (CC-30, spec OQ-5). `reason` is present exactly when
`outcome === 'failed'`; `receivedAmount` and `receivedToken` exactly when `outcome === 'success'`.
The optionality is expressed in the type as written above rather than as a discriminated union,
matching how `PrepareTransactionResult` and `TxStatusResponse` already declare conditionally-present
fields in this SDK; the invariant is stated in the README and verified in T-4 rather than encoded.

### D-7 — Received amount, token and destination hash come from `receiving`, never from the quote *(CC-18, CC-19)*

Measured on a completed transfer:

```
sending:   { txHash, chainId 42161, amount "550000000000000", token ETH  }
receiving: { txHash, chainId 42161, amount "1032392",         token USDC @ 6 }
```

`receiving.amount` is a decimal string → `BigInt()` (SDK-1). `receiving.token` maps through the
existing `toTokenInfo` helper, so the published shape is `SwapTokenInfo` and the routing service's
own `Token` type never crosses the boundary (002's TR-1).

The trap: on a **pending** transfer, `receiving` is the `PendingReceivingInfo` variant — `{ chainId }`
and nothing else, no `txHash`, no `amount`, no `token`. On a **failed** one, measured above,
`receiving` is absent entirely. So the mapping reads `receiving` defensively and leaves all three
fields undefined rather than fabricating them, and `destinationTxHash` is omitted rather than
falling back to the origin hash (CC-19 says this in as many words).

Note for the record: on a *same-chain* transfer `receiving.txHash === sending.txHash`, visible in
the measurement above. Irrelevant in practice — CC-2 and CFC-7 mean this operation is never called
for a same-chain swap — but it is why CC-19 forbids the fallback rather than leaving it to taste.

### D-8 — `getSwapSettlement`, in its own file, with no RPC endpoint *(CC-11, CC-12, CC-22)*

```
src/swap/getSwapSettlement.ts     CC-11..CC-21
src/swap/internal/lifiClient.ts   + fetchSettlement (D-1, D-2)
src/types/swap.ts                 + the four types of D-6, + GetSwapSettlementParams
```

```ts
getSwapSettlement(params: GetSwapSettlementParams): Promise<SwapSettlementReport>

interface GetSwapSettlementParams {
  txHash: string
  fromChainId: number
  toChainId: number
}
```

**No `rpcUrl`.** This is the only public swap operation that reads no chain — it asks the routing
service and nothing else. Requiring an endpoint it would never use would be a parameter the
consumer has to supply and the implementation has to ignore.

**No quote** (CC-12): the three primitives above are all a consumer must keep across an application
restart. The upstream treats `fromChain`/`toChain` as optional — the probe without them answered
correctly, searching every chain — but they are required here, because the consumer always has them
and passing them scopes the lookup instead of leaving it to a cross-chain search.
*(This is the one place the spec needs a word changed: CFC-8's closing sentence says the consumer
must durably keep "that hash", where it should say the hash and the two chain ids. Flagged at the
gate rather than edited silently.)*

**No chain-support guard.** `getSwapSettlement` does not check either chain against
`SWAP_SUPPORTED_CHAINS`. It answers a question about a transaction that already exists and funds
that are already in flight; refusing to answer because a chain was removed from the supported set
between broadcasting and asking would strand a consumer mid-swap with money on the wire and no way
to learn where it went. `UNSUPPORTED_CHAIN` belongs to quoting, where it can still prevent
something.

**Naming.** Not `getSwapStatus` — `txStatus` already exists and means a receipt reading, and two
"status" operations answering different questions is exactly the confusion CC-26 is trying to
prevent. Not `waitForSettlement` — it does not wait, and 001's naming note applies: nothing here is
named for something it does not do.

### D-9 — One code out, one in — and the honest cost of the one going out *(CC-28, CC-29)*

`src/types/swap.ts` loses `'CROSS_CHAIN_NOT_SUPPORTED'` from `SwapErrorCode` and gains
`'UNSUPPORTED_RECIPIENT'`. The set stays nine.

**Adding is free.** `SwapErrorCode` appears in a thrown position, so a consumer's `switch` simply
never takes the new branch until it writes one.

**Removing is not, and calling it free would be wrong.** TypeScript rejects a `case` clause whose
literal cannot overlap the narrowed union, so any consumer with

```ts
case 'CROSS_CHAIN_NOT_SUPPORTED':
```

**fails to compile** against 1.9.0. Strict semver makes that a major.

It is proposed as a **minor** anyway, deliberately:

- The break is precisely the one we want. That branch is dead code the moment this ships, and the
  compiler pointing at it is better than the frontend keeping a path it believes is reachable —
  which is the whole reason CC-28 rejected the alternative of keeping the code declared and never
  raised.
- The blast radius is one consumer, in this team's own repo, and the fix is deleting a case.
- The precedent in this package is that published-type changes have shipped as minors (001's
  `TxStatusResponse.status` in 1.7.0, 002's additions in 1.8.0).

Nothing about the decision changes if the answer is 2.0.0 instead — only the version string and the
release note. **Flagged at the gate** as the one call in this plan that is a publishing judgement
rather than a technical one.

---

## Public surface

Added:

```ts
getSwapSettlement(params: GetSwapSettlementParams): Promise<SwapSettlementReport>
```

Plus the types `GetSwapSettlementParams`, `SwapSettlementReport`, `SwapSettlementOutcome`,
`SwapSettlementReason`.

Changed: `SwapErrorCode` — `CROSS_CHAIN_NOT_SUPPORTED` out, `UNSUPPORTED_RECIPIENT` in (D-9).

Unchanged in name, parameters and return shape, honouring FC-13: `getSwapQuote`,
`buildSwapApprovalTxs`, `buildSwapTx`, `resolveSwapState`, `getSwapSupportedChainIds`,
`getCuratedSwapTokens`, `getAllSwapTokens`, `isSwapError`, and every type 001 and 002 published.
`SwapQuote` gains no field: `toChainId` was there from the start (FC-13's whole point).

---

## Flow the consumer implements

Cross-chain. Steps 1-4 are 001's flow with no edit.

1. `getSwapQuote({ … fromChainId: 137, toChainId: 8453, … })` → `SwapQuote`
2. `buildSwapApprovalTxs({ quote, … })` → `[]`, `[tx]` or `[reset, approve]` — **on the origin
   chain** (CFC-4)
3. If non-empty: sign each, `broadcastTransaction`, poll `txStatus`,
   `resolveSwapState({ phase: 'approval', outcome })` until `approved`
4. **Re-quote** (FC-15, unchanged — CFC-17)
5. `buildSwapTx({ quote: freshQuote, … })` → sign → `broadcastTransaction` → **origin hash**.
   Persist that hash plus the two chain ids (CFC-8); everything after this point survives a restart
6. Poll `getSwapSettlement({ txHash, fromChainId, toChainId })` → `SwapSettlementReport`
7. `resolveSwapState({ phase: 'swap', outcome: report.outcome })` — feeds in directly, no
   conversion (D-6)
8. `done` → release the balance refresh, **on the destination chain**, and display
   `report.receivedAmount` / `report.receivedToken`, not the quoted figures (CFC-11)
9. `error` → branch on `report.reason`: `refunded` means the input is back on the origin chain and
   nothing was exchanged (CFC-12)

**`txStatus` is not in the cross-chain loop at all** after step 3 (D-3). The origin receipt is never
consulted in the swap phase, which removes any opportunity to feed its `success` into the resolver
— the failure mode CFC-6 exists to prevent, now structurally absent rather than merely documented.

A same-chain swap follows 001's flow unchanged and never reaches step 6.

---

## Traceability

| Clause | Implemented in |
|---|---|
| CC-1 | deletion of the guard in `getSwapQuote.ts` (D-5) |
| CC-2 | absence — no edit reachable from a same-chain request; verified by diff and by T-7 |
| CC-3, CC-6 | guards in `getSwapQuote.ts` (D-5) |
| CC-4 | `fetchTokensForChains` in `getSwapQuote.ts` (D-5, reusing 002's D-4) |
| CC-5 | absence — no pair matrix; `NO_ROUTE` from `fetchQuote` unchanged |
| CC-7 | absence — `fetchQuote` already maps `action.toToken` (D-4) |
| CC-8 | absence — `expiresAt` stamping in `getSwapQuote.ts` unchanged |
| CC-9, CC-10 | absence — empty diff on `buildSwapApprovalTxs.ts` and `buildSwapTx.ts` (D-4) |
| CC-11, CC-12 | `getSwapSettlement.ts` + `fetchSettlement` (D-1, D-8) |
| CC-13 – CC-17 | the mapping table in D-2 |
| CC-18, CC-19 | `receiving` mapping (D-7) |
| CC-20 | absence — no timer, no deadline, no retry anywhere in `getSwapSettlement.ts` |
| CC-21 | fall-through row of D-2's table |
| CC-22 | absence — no module-level state, no polling loop |
| CC-23, CC-24 | absence — `resolveSwapState.ts` and `SwapState` untouched |
| CC-25, CC-26, CC-27 | `resolveSwapState`'s existing table, reached with the settlement outcome (D-6) |
| CC-28, CC-29 | `SwapErrorCode` in `types/swap.ts` (D-9) |
| CC-30 | `SwapSettlementReason` as a separate type (D-6) |
| CFC-1 – CFC-18 | the public surface above; CFC-6, CFC-10, CFC-11, CFC-12, CFC-13 are consumer-side and documented in README |

---

## Verification approach

Same two methods as 001 and 002, recorded per task in `tasks.md`. No test runner is introduced.

- **Pure** — deterministic, no chain: D-2's mapping table driven by an injected fake adapter across
  every upstream shape including the ones not observed live; the `receiving`-absent and
  `receiving`-pending variants; the four `getSwapQuote` edits with zero network calls asserted where
  the clause demands it; `SwapSettlementOutcome`'s assignability to `resolveSwapState`'s parameter
  checked at compile time.
- **Chain** — executed on a low-cost mainnet with real funds, recording chains, pair, amount, origin
  hash, destination hash and elapsed time.

**Chains for the on-chain run:** Polygon (137), Base (8453), Linea (59144), BSC (56) and Scroll
(534352) — all five are in 001's supported set. Executed manually from the `wallet-broadcasting`
test repo against a symlinked build, as in 001 and 002.

The cross-chain runs differ from 001's in one practical respect: each scenario takes minutes rather
than seconds, and the interesting part is the *middle* of it. Every run therefore records the report
at three points — right after broadcast (expected `pending` via 404), mid-flight (expected `pending`
via a 200), and at settlement — because the 404→`pending` mapping of D-2 is the single most
consequential line in this feature and only the first of those three observations exercises it.

---

## Risks and open items

- **R-1 — A wrong hash is `pending` forever, by design.** D-2 maps 404 to `pending`, and CC-20
  forbids a timeout. A consumer that stores the wrong hash, or asks about a chain pair the
  transaction was not on, polls indefinitely with no SDK-side rescue. This is the deliberate cost of
  CC-13's refusal to distinguish not-yet-indexed from does-not-exist — a distinction that cannot be
  made from outside without inventing a deadline. Named here rather than hedged: the consumer owns
  the give-up policy (CFC-13), and the README says so.
- **R-2 — Polling an unauthenticated endpoint, times a hundred.** A ten-minute transfer polled every
  five seconds is ~120 requests against `li.quest` per swap, with no API key. 001's R-3 already
  flagged rate limiting as a thing to watch with only a per-request `integrator` string for
  attribution; sustained polling makes it materially more likely, and it is the one upstream failure
  that would surface as `PROVIDER_ERROR` in the middle of an otherwise healthy swap. The SDK cannot
  bound it — cadence is the consumer's by CC-22 — so the README recommends a floor of one request
  every 5–10 seconds and exponential backoff on `PROVIDER_ERROR`. Worth measuring during T-8.
- **R-3 — `PARTIAL` can deliver a token that was never quoted.** CC-18 and the report carry it, but a
  consumer rendering `report.receivedToken` must be prepared for a symbol and an address it never
  showed the user. Not hypothetical: `PARTIAL` is upstream's normal answer when the destination-side
  swap could not be performed and the bridged token was delivered instead. No scenario in the
  on-chain run is expected to provoke it, so it stays verified against a fixture.
- **R-4 — The retired code is a compile break.** See D-9. Unresolved by design until the gate settles
  1.9.0 versus 2.0.0.
- **R-5 — D-3's evidence is one inference wide.** The `FAILED` answer for a reverted origin
  transaction was measured on reverted *same-chain* routing-service swaps, not on a reverted bridge.
  T-8 closes it opportunistically if a real cross-chain revert occurs; provoking one deliberately
  costs a transaction and is not planned.
- **R-6 — `executionDuration` is published upstream and not by us.** The measured cross-chain quote
  carried `executionDuration: 1`. Surfacing an ETA is out of scope (spec §Out of scope), so a
  consumer that wants to show "about 2 minutes" has no SDK-supplied value and will invent one. Worth
  revisiting in a later spec if the frontend ends up hardcoding a number, which is the outcome to
  watch for.
