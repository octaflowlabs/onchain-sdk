# 002 — Implementation plan

Technical decisions for [spec.md](./spec.md). Every decision cites the clauses it serves.
Where this document and the spec disagree, the spec wins.

`D-n` identifiers are local to this plan. Decisions of 001's plan are referenced in full, as
"001's D-6", since both documents number from one.

**Target release:** `@octaflowlabs/onchain-sdk` **1.8.0** (minor: additive surface plus a
deprecation marker that changes no behaviour).

---

## Decisions

### D-1 — Two operations, named for curation rather than for cost *(TFC-1, TFC-2, TFC-3)*

```ts
getCuratedSwapTokens(chainId: number): SwapToken[]
getAllSwapTokens(params: GetAllSwapTokensParams): Promise<Record<number, SwapToken[]>>
```

`get` versus `fetch` cannot carry the synchronous/asynchronous distinction here: this SDK already
uses `get` for both — `getBalances` and `getTokenMetadata` hit the network, `getProvider` and
`getSwapSupportedChainIds` do not. Encoding it in the prefix would be a convention invented for
one feature and contradicted by the rest of the package. So the names carry the axis that is
actually load-bearing at the call site — **curated** versus **all** — and the return type carries
the cost: a `Promise` means network, a plain array means it cannot fail (TFC-2).

`getAllSwapTokens` takes a parameter object, matching 001's four operations, and leaves room for a
later option without a signature break. `getCuratedSwapTokens` takes a positional `chainId`,
matching `isSwapSupportedChain` and `getStablecoinContractsByChainId`.

There is deliberately no `getAllCuratedSwapTokens()`. A consumer that wants every chain composes
the two exports it already has:

```ts
getSwapSupportedChainIds().map(getCuratedSwapTokens)
```

TFC-1 says two operations, and a third that is a one-line composition of two others would be
surface for its own sake.

### D-2 — `SwapToken` extends the `SwapTokenInfo` 001 already ships *(TR-1, TR-4, TR-5)*

```ts
export interface SwapToken extends SwapTokenInfo {
  chainId: number
  name: string
  isNative: boolean
  logoURI?: string
}
```

`SwapTokenInfo` (`address`, `decimals`, `symbol`) is exactly the subset a quote carries, so
extension is the honest relation: a `SwapToken` is usable anywhere a `SwapTokenInfo` is expected,
and the two cannot drift apart in what they call an address or a symbol.

`SwapQuote.fromToken` / `toToken` stay `SwapTokenInfo` and are **not** widened to `SwapToken`.
Widening them would mean the quote path now has to source a name and a logo it has no use for,
and it would change a type published in 1.7.0.

**Field naming:** `logoURI`, not `iconUrl`. It is the name used by the Uniswap token-list standard
and by the routing service's own payload, so the mapping is a copy rather than a rename, and a
consumer that already knows the ecosystem shape reads it without a lookup. The cost is one rename
for anyone migrating off `BASIC_TOKENS_BY_CHAIN.iconUrl` (D-7), paid once.

`logoURI` is optional in the type because most of the full set genuinely has no usable logo — 267
of Base's 946 tokens and 611 of Ethereum's 5,321, once TR-19 drops the dead host. TR-5's stronger
guarantee for curated entries is a property of the registry's content, enforced by T-3's
verification, not by the type.

### D-3 — The curated registry is a generated static constant, verified at authoring time *(TR-2, TR-3, TR-8, TR-10, TR-18)*

Lives in `src/constants/SWAP_TOKENS_REGISTRY.ts`, next to `NETWORKS_REGISTRY`,
`STABLECOINS_REGISTRY` and `SWAP_SUPPORTED_CHAINS`, with `getCuratedSwapTokens` exported from that
same file — the precedent `getSwapSupportedChainIds` sets in 001's D-2.

**Every field is generated from the routing service's own response, never hand-typed.** A one-off
authoring script (kept in the scratchpad, not shipped) reads `GET /v1/tokens` for the 16 supported
chains, selects the candidates that satisfy TR-2, and emits the TypeScript literal with `address`,
`decimals`, `symbol`, `name` and `logoURI` copied verbatim. Hand-typing ~200 entries across 16
chains would invite exactly the class of defect — a wrong address, a wrong decimals — that is
silent in a selector and expensive in a swap. Generating them also makes TR-18's dated
verification true by construction at the moment of authoring: an entry exists because it was in
the upstream list.

Candidate selection under TR-2, per chain: the native currency (zero address); its wrapped
equivalent; every entry of `STABLECOIN_CONTRACTS_BY_CHAIN_ID` for that chain; then majors — WBTC,
WETH and the chain's own ecosystem token — seeded from `BASIC_TOKENS_BY_CHAIN` and pruned by hand
against the upstream list. TR-3's cap of 20 is an upper bound, not a target: thin chains
(HyperEVM, Plasma) will land far below it and that is the correct outcome, not a gap to fill.

**Ordering is the literal's order** (TR-10), not a runtime sort. A sort would need a predicate for
"is a stablecoin", which means `getCuratedSwapTokens` — a function TFC-2 says cannot fail —
starts depending on a second registry that can disagree with this one. The order is baked in when
the file is generated and asserted by T-3.

**Logos are resolved by D-9's chain, not copied**, and that is the one field the generation script
does not take on trust. TR-5 admits no exception, so the file cannot be generated with a hole in
it: a candidate whose logo cannot be resolved by any source is dropped from the curated set and
reported by the script, not shipped without one.

### D-4 — One token cache, two readers *(TR-11, TR-12, TR-16)*

This is the decision TR-12 turns on. `internal/lifiClient.ts` today holds `tokensByChain` and
`fetchTokens(chainId)`, and 001's `getSwapQuote` validates `UNSUPPORTED_TOKEN` against it. The
full-set reader must not become a second path with its own cache and its own filter — that is
precisely how the published list and the validation list drift apart.

So `lifiClient` grows one function and `fetchTokens` becomes a wrapper over it:

```ts
fetchTokensForChains(chainIds: number[]): Promise<Record<number, Token[]>>
fetchTokens(chainId: number): Promise<Token[]>   // now: fetchTokensForChains([chainId])[chainId]
```

`fetchTokensForChains` deduplicates the requested ids, serves from `tokensByChain` whatever is
already there, and issues **one** `getTokens({ chains: [...missing] })` for the remainder —
verified on 2026-08-05 that `chains=1,8453,42161` returns all three keyed by chain id in a single
round-trip. When nothing is missing, no request is made at all (TR-16).

`getTokens` is called with `chains` only. **No `minPriceUSD`, no `chainTypes`, no filter of any
kind** — TR-12 as a code-level invariant: there is one call site, and it takes one argument.

001's `getSwapQuote` keeps calling `fetchTokens` and does not change. Its cache is now populated by
whichever reader ran first, which is the intended consequence: the set a consumer was shown and
the set SDK-10 validates against are the same object.

### D-5 — The `Token` → `SwapToken` mapping lives in `lifiClient`, `isNative` reuses 001's address rule *(TR-1, TR-4, TR-6)*

`lifiClient.ts` stays the only module importing `@lifi/sdk` (001's D-1 and D-11), so the mapping
belongs there and nowhere else. It sits beside the existing `toTokenInfo`, which is left untouched.

`isNative` is computed with `isNativeTokenAddress` from `internal/nativeToken.ts` — the zero-address
comparison of 001's D-6, never a symbol comparison. Ten of the sixteen chains have a non-`ETH`
native symbol, and this is the same trap that decision was written for. Reusing it also makes TR-6
and 001's SDK-14 answer to one predicate: the token a consumer sees flagged native is by
construction the token for which the approval list comes back empty (TFC-7).

The mapping also **drops the logo location when it points at the dead host** (TR-19, D-9). The one
host is named as a constant in this file, next to the mapping, with the traceability comment
citing TR-19 — the single place in the codebase that knows the routing service's payload shape,
which is where a fact about that payload belongs.

`getAllSwapTokens` therefore owns no mapping logic. It validates chains, calls
`fetchTokensForChains`, and maps.

### D-6 — Failure asymmetry is implemented as a guard order, and both readers hand back copies *(TR-9, TR-13, TR-14)*

`getCuratedSwapTokens` is a lookup returning `[...registry[chainId] ?? []]` — an unsupported chain
is simply a missing key, so TR-9's empty set needs no branch and there is no failure path to get
wrong.

`getAllSwapTokens` validates **every** requested id against `isSwapSupportedChain` before any
network access and throws `SwapError('UNSUPPORTED_CHAIN')` naming the offending ids (TR-13). Any
upstream failure, or a response missing a requested chain, propagates the `PROVIDER_ERROR` that
`fetchTokensForChains` already raises, and nothing partial is returned (TR-14) — which is free,
since one failed request fails the whole call.

Both readers return **fresh arrays**, never the frozen registry array or the cached upstream one.
`getSwapSupportedChainIds` already sets this precedent with its spread. A consumer that sorts a
returned list in place must not be able to reorder a registry that TR-10 says is stable, or poison
the cache that SDK-10 validates against.

An empty `chainIds` returns `{}` before the guard and before any network access (TR-20). Duplicate
ids are deduplicated, so a chain is never requested or mapped twice.

### D-7 — `BASIC_TOKENS_BY_CHAIN` is deprecated with `@deprecated`, and nothing else changes *(TR-17, TFC-11)*

The export, its type and its contents stay exactly as they are; a `@deprecated` JSDoc tag is added
to `BASIC_TOKENS_BY_CHAIN` and to `BasicTokenData`, naming `getCuratedSwapTokens` as the successor.

**This is a deliberate reading of CLAUDE.md's comment ban.** The rule forbids explanatory comments
and JSDoc descriptions of what a function does. `@deprecated` is neither: it is a machine-readable
annotation that TypeScript propagates into `dist/index.d.ts`, strikes through in the consumer's
editor, and surfaces in tooling. It is closer to the clause-traceability exception than to prose —
it exists to be read by a compiler, and a comment is the only place TypeScript accepts it.

The `amount` and `usdValue` fields die with the deprecation and have no successor, per TR-7. The
file's own header already says it is not a source of truth; this closes that loop rather than
opening a new one.

**Nothing existing breaks.** `BASIC_TOKENS_BY_CHAIN`, `MOCK_TOKENS`, `getTokensByChain`,
`BasicTokenData`, `BasicTokenSymbol` and `ChainTokenDataMap` all keep their exports, types and
contents. 002 is additive; D-10 is the bridge, not a repair.

### D-10 — The legacy conversion is a lossy, deprecated-on-arrival adapter *(TR-21, TR-22, TR-23, TFC-12, TFC-13)*

```ts
toLegacyTokenData(tokens: SwapToken[]): LegacyTokenData[]
```

Field mapping, with every lossy edge stated rather than smoothed over:

| Legacy field | Source | Note |
|---|---|---|
| `id` | `symbol.toLowerCase()` | The legacy ids are `'eth'`, `'usdc'` — a coin key, not an identifier. It repeats across chains there too, so this reproduces the existing behaviour rather than a defect of the mapping. |
| `address` | `isNative ? null : address` | **TR-23.** The one edge that can bite: the swap path needs the zero address, so a converted native token is render-only (TFC-13). |
| `chainId`, `name`, `decimals`, `isNative` | copied | — |
| `symbol` | copied, typed `string` | See below. |
| `iconUrl` | `logoURI ?? ''` | The legacy field is a required string, so absence collapses to `''` — the ambiguity TR-19 removed, reintroduced only inside the bridge. |
| `amount`, `usdValue` | `''` | **TR-22.** Never fabricated. A consumer reading them gets nothing, which is the honest answer, and the reason to migrate. |

**The one seam that cannot be closed:** `BasicTokenData.symbol` is `BasicTokenSymbol`, a closed
union of 27 literals, and real symbols do not fit it — `AERO` is not a member and never will be
without editing a published type on every listing. So the adapter returns

```ts
type LegacyTokenData = Omit<BasicTokenData, 'symbol'> & { symbol: string }
```

which is structurally identical at runtime and requires the consumer to widen one type annotation
at compile time. The alternatives were both worse: widening `BasicTokenSymbol` itself changes a
type published in 1.7.0, and constraining the registry to 27 symbols would let a deprecated union
dictate what tokens the SDK may publish.

`toLegacyTokenData` carries `@deprecated` from its first commit, pointing at `SwapToken`, on the
same reasoning as D-7. It lives in `src/constants/BASIC_TOKENS_REGISTRY.ts`, next to what it
converts to — so when TR-17's removal finally happens in a major, the adapter is deleted in the
same edit and cannot be left orphaned.

### D-8 — No cache escape hatch, and the risk is named rather than hedged *(TR-16, TFC-10)*

`fetchTokensForChains` keeps 001's process-lifetime cache with no public way to clear it, exactly
as spec.md's Out of scope states. Adding a `refresh` option now would be a public parameter whose
only consumer is hypothetical, and it is additive later if a long-lived session proves to need one.
Recorded as R-3 rather than designed around.

### D-9 — Curated logos: CoinGecko, then LI.FI, then Trustwallet, each probed *(TR-5, TR-19)*

Resolution order per curated candidate, at generation time only. The first source that answers
HTTP 200 wins; a source that 404s, 403s or times out falls through to the next:

1. **CoinGecko.** `GET /api/v3/coins/list?include_platform=true` maps address → coin id for every
   chain in one 2.8 MB response, no API key (verified 2026-08-05: 18,137 coins, 2,561 of them
   carrying a Base address). `GET /api/v3/coins/{id}` then yields the image URL. That is ~200
   further calls against a rate-limited free tier — acceptable because it runs once, at authoring
   time, and never in the published package.
2. **The routing service's own `logoURI`**, when it is not the dead host.
3. **Trustwallet's deterministic path** —
   `raw.githubusercontent.com/trustwallet/assets/master/blockchains/<chain>/assets/<checksummed>/logo.png`
   — derivable from the address with no API at all. Last because it is unreliable on its own:
   AAVE and AERO answer 200 while UNI 404s.

**CoinGecko leads for visual consistency, not for availability.** All three sources rot — the 18
CoinGecko URLs already in `BASIC_TOKENS_BY_CHAIN` include one that now 403s (xDAI). What makes the
published field trustworthy is the probe, which is why every option in this order carries the same
one. Leading with CoinGecko means the majority of a curated set shares one house style, which is
visible when twenty icons sit in a column and invisible in any single-token view.

The probe is what makes TR-5 an assertion rather than a hope, and T-3 re-runs it over the shipped
file so the guarantee is verified against what was published, not against what the script believed
it published.

---

## Public surface

```ts
getCuratedSwapTokens(chainId: number): SwapToken[]
getAllSwapTokens(params: GetAllSwapTokensParams): Promise<Record<number, SwapToken[]>>
```

Plus the deprecated migration bridge (D-10):

```ts
toLegacyTokenData(tokens: SwapToken[]): LegacyTokenData[]
```

Plus the types `SwapToken`, `GetAllSwapTokensParams` and `LegacyTokenData`:

```ts
interface GetAllSwapTokensParams {
  chainIds: number[]
}
```

`SWAP_TOKENS_REGISTRY` itself is **not** exported — only the accessor, matching 001's D-2, so the
registry cannot be mutated and its shape stays free to change.

Everything is re-exported from `src/index.ts` under the existing `/** swap exports */` and
`/** swap types exports */` blocks, explicitly named, no `export *`, types carrying the `type`
modifier — 001's D-11, whose **standing rule still applies: a task that creates public surface
exports it in the same change.**

### Files

```
src/constants/SWAP_TOKENS_REGISTRY.ts   generated literal + getCuratedSwapTokens   TR-2,3,8,9,10
src/swap/getAllSwapTokens.ts            chain guard + mapping                      TR-11,13,14
src/swap/internal/lifiClient.ts         fetchTokensForChains, toSwapToken          TR-12,16, D-4, D-5
src/types/swap.ts                       SwapToken, GetAllSwapTokensParams          TR-1,4,5
src/constants/BASIC_TOKENS_REGISTRY.ts  @deprecated markers + toLegacyTokenData    TR-17,21,22,23
src/index.ts                            six new exports
```

No new dependency. `@lifi/sdk` stays pinned at `3.1.5` and still imported from exactly one file.

---

## Flow the consumer implements

1. `getSwapTokensSupportedChainIds()` → the chains to offer *(001, FC-12)*
2. `getCuratedSwapTokens(chainId)` → render the selector immediately, no await, no failure state
3. On "show all" or on a search miss: `getAllSwapTokens({ chainIds: [chainId] })`, with a spinner
   and a `PROVIDER_ERROR` branch
4. Join either list with the SDK's existing balance reading *(TFC-9)*
5. Selected token → `getSwapQuote(...)` *(001)*, where `UNSUPPORTED_TOKEN` and `NO_ROUTE` remain
   possible for a curated token *(TFC-4)*

Step 1 is `getSwapSupportedChainIds`; the line above names it as the consumer sees it.

---

## Traceability

| Clause | Implemented in |
|---|---|
| TR-1 | `types/swap.ts`; mapping confined to `internal/lifiClient.ts` (D-5) |
| TR-2, TR-3 | `SWAP_TOKENS_REGISTRY.ts` content + generation script (D-3) |
| TR-4, TR-5 | `SwapToken` (D-2) + registry generation (D-3) + logo resolution chain (D-9) |
| TR-6 | `isNativeTokenAddress` reuse (D-5) |
| TR-7 | absence — no balance, amount or price field on `SwapToken` |
| TR-8, TR-9, TR-10 | `getCuratedSwapTokens` (D-3, D-6) |
| TR-11 | `fetchTokensForChains` (D-4) |
| TR-12 | one cache, one unfiltered `getTokens` call site (D-4) |
| TR-13 | `isSwapSupportedChain` guard before any network access (D-6) |
| TR-14 | `PROVIDER_ERROR` from `fetchTokensForChains`, all-or-nothing (D-6) |
| TR-15 | absence — no sort applied to a full set |
| TR-16 | `tokensByChain`, unchanged from 001 (D-4, D-8) |
| TR-17 | `@deprecated` on `BASIC_TOKENS_BY_CHAIN` (D-7) |
| TR-18 | generation + dated header in `SWAP_TOKENS_REGISTRY.ts` (D-3) |
| TR-19 | dead-host constant + omission in the `SwapToken` mapping (D-5); probe at generation (D-9) |
| TR-20 | early return in `getAllSwapTokens`, before the chain guard (D-6) |
| TR-21, TR-22, TR-23 | `toLegacyTokenData` in `BASIC_TOKENS_REGISTRY.ts` (D-10) |
| TFC-1 – TFC-11 | the public surface above; TFC-4, TFC-5, TFC-8, TFC-10, TFC-11 documented in README |

---

## Verification approach

Unchanged from 001: no test runner is introduced. Three modes, recorded per task in `tasks.md`.

- **Pure** — deterministic, no chain: the curated registry's shape and invariants, guard order,
  copy-not-reference, the empty-chain-id cases, `SwapToken` mapping against fixtures.
- **Live** — read-only calls, no gas, no wallet: every curated entry cross-checked against
  `GET /v1/tokens` for its chain, the multi-chain round-trip, and **every shipped `logoURI` fetched
  and asserted to answer 200** (TR-5). That last one is run against the file as published, not
  against the generation script's own belief about it.
- **Review** — satisfied by absence or by shape; confirmed by reading the diff and the emitted
  `.d.ts`.

No on-chain verification is needed: this feature builds no transaction and spends no gas. The one
place it touches the swap path is the shared cache (D-4), and that is verified by confirming a
quote still succeeds for a token read through the new reader.

---

## Risks and open items

- **R-1 — The curated registry drifts.** TR-18 accepts this by design: entries are verified when
  authored, not per call. TFC-4 makes the consequence non-fatal — a delisted token yields
  `UNSUPPORTED_TOKEN` at quote time, which the consumer already handles. The mitigation is the
  dated header, exactly as `SWAP_SUPPORTED_CHAINS.ts` carries one.
- **R-2 — Every logo host will eventually rot, and the probe only proves a moment.** D-9 verifies
  each curated URL at generation time, which is the strongest thing a static registry can do — it
  is not a guarantee about next month. `assets.coingecko.com`, `static.debank.com` and
  `raw.githubusercontent.com` are hosts this SDK does not control, and the consumer's selector
  requests them directly, so a strict CSP has to allow them and a dead host degrades to the same
  placeholder TR-19 already requires. The Zapper bucket (OQ-4) is what this risk looks like when
  it fires, and it fired before we shipped. Accepted for now; hosting our own images is named in
  spec.md's Out of scope as the real answer. **Re-running D-9's probe is the maintenance task that
  keeps TR-5 true, alongside R-1's drift check — both belong to the same periodic sweep.**
- **R-6 — CoinGecko's free tier rate-limits the generation script.** ~200 `/coins/{id}` calls at
  roughly 10-30 requests per minute means a run of some minutes, and a 429 mid-run must fall
  through to the next source rather than silently drop a logo. It runs once, off the critical path,
  and never in the published package — but the script has to distinguish "CoinGecko has no image"
  from "CoinGecko throttled us", or the registry quietly loses its visual consistency.
- **R-3 — The cache has no escape hatch** (D-8). A long-lived tab will not see a token added
  upstream until it reloads. Additive to fix.
- **R-4 — `Record<number, SwapToken[]>` keys survive JSON badly.** A consumer that serialises the
  result gets string keys back. Not wrong, but worth stating in the README; the alternative — an
  array of `{ chainId, tokens }` — is clumsier at every call site that indexes by chain.
- **R-5 — TR-3's cap is a judgement, not a measurement.** Twenty is an upper bound chosen to keep
  the set selector-sized. If a chain's honest TR-2 answer exceeds it, the cap is the thing to
  revisit, not the criterion.
