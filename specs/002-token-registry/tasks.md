# 002 — Tasks

Execution order for [spec.md](./spec.md) under [plan.md](./plan.md). Every task cites the clauses
it satisfies and how it is verified.

**Verification legend** — `pure`: deterministic, invoked directly against a written expected value,
no network. `live`: read-only calls against `li.quest`, CoinGecko or a logo host — no gas, no
wallet, no signing. `review`: satisfied by absence or by shape; confirmed by reading the diff and
the emitted declarations.

**Status legend** — `[ ]` not started · `[~]` in progress · `[x]` done. A task earns `[x]` only
once its own verification has actually run (not merely written) and its public symbols resolve
from `src/index.ts`.

Package manager is **yarn**. Format with `yarn prettier` and compile with `yarn build` before
closing any task.

**Standing rule (001's D-11, TFC-1)** — a task that creates public surface exports it from
`src/index.ts` in the same change, in the existing explicit-barrel style. Nothing under
`src/swap/internal/` is ever exported. A task is not closed while its public symbols are
unreachable from the package entry point.

**No task in this spec spends gas or touches a key.** This feature builds no transaction; the only
contact with 001's swap path is the shared token cache, and T-8 is where that is proven.

---

## Foundations

### [x] T-1 · The published token type
**File:** `src/types/swap.ts`, `src/index.ts`
**Satisfies:** TR-1, TR-4, TR-7, TFC-9 · **Plan:** D-2

Define `SwapToken extends SwapTokenInfo` with `chainId`, `name`, `isNative` and optional
`logoURI`, plus `GetAllSwapTokensParams`. No field carries a balance, an amount or a price
(TR-7). No type from `@lifi/sdk` appears anywhere in the file (TR-1). Both types re-exported from
`src/index.ts` under the existing `/** swap types exports */` block.

**Verify** `pure` — `SwapToken` has exactly seven members; a `SwapToken` is assignable to
`SwapTokenInfo` at compile time and the reverse is not; `logoURI` accepts omission and `name`
does not; `tsc --noEmit` passes. `review` — grep the file for `amount`, `usdValue`, `price`,
`balance`: zero hits (TR-7 by absence). Both types resolve from the package entry point.
**Depends on:** —

### [x] T-2 · Multi-chain reader and the `SwapToken` mapping
**File:** `src/swap/internal/lifiClient.ts`
**Satisfies:** TR-1, TR-6, TR-11, TR-12, TR-16, TR-19 · **Plan:** D-4, D-5

Add `fetchTokensForChains(chainIds)` and make `fetchTokens(chainId)` a wrapper over it, so
`tokensByChain` stays the single cache that 001's `getSwapQuote` already validates against (D-4).
Deduplicate the requested ids, serve what is cached, and issue **one** `getTokens({ chains })` for
the remainder — `chains` and nothing else, no `minPriceUSD`, no `chainTypes` (TR-12). When nothing
is missing, issue no request at all (TR-16).

Add `toSwapToken(token)` beside the existing `toTokenInfo`, which is left untouched. `isNative`
comes from `isNativeTokenAddress` (001's D-6), never from a symbol. The dead logo host is a named
constant in this file, and a `logoURI` pointing at it is dropped rather than published (TR-19).

Internal module: nothing here is exported from the barrel (001's D-11).

**Verify** `pure`, via the injected fake `@lifi/sdk` T-5 of 001 already established: three chains
request produces **exactly one** call, whose argument object has exactly one key, `chains`
(TR-12); a chain already cached is excluded from that argument; all-cached issues **zero** calls
(TR-16); duplicate ids are requested once; a response missing a requested chain raises
`PROVIDER_ERROR`. On the mapping: a zapper URL yields `logoURI === undefined` while a
`static.debank.com` URL survives unchanged (TR-19); the zero address yields `isNative: true` and
BNB, AVAX and xDAI at their real non-zero addresses each yield `false` (TR-6 — the symbol trap
001's D-6 was written for).
`live` — `fetchTokensForChains([1, 8453, 42161])` returns three populated keys in a single
round-trip.
`review` — `getTokens` appears at exactly one call site in the codebase; `fetchTokens` keeps its
old signature and `getSwapQuote.ts` is not modified by this task.
**Depends on:** T-1

---

## The curated set

### [x] T-3 · Logo resolution and the generation script
**File:** none shipped — script lives in the scratchpad
**Satisfies:** TR-2, TR-5, TR-18, TR-19 · **Plan:** D-3, D-9

The authoring tool that produces T-4's file. Reads `GET /v1/tokens` for the 16 supported chains,
selects candidates under TR-2, and emits the TypeScript literal with `address`, `decimals`,
`symbol` and `name` copied verbatim from the upstream response — never hand-typed (D-3).

Logos are resolved through D-9's chain, each source probed with a real request and accepted only
on HTTP 200: CoinGecko (`/coins/list?include_platform=true` once for address → id, then
`/coins/{id}`), then the upstream `logoURI` when it is not the dead host, then Trustwallet's
deterministic path.

**The script must distinguish "CoinGecko has no image" from "CoinGecko throttled us"** (R-6). A
429 is a retry or a fall-through, never a recorded absence — conflating them silently drains the
visual consistency that ordering CoinGecko first was meant to buy. The script emits a per-token
report naming the winning source and why each earlier one was skipped. A candidate whose logo
cannot be resolved by any source is **dropped from that chain's curated set and reported**, not
shipped without one (TR-5 admits no exception for a *published* entry, but admits that a
candidate may simply not be admitted) — matching D-3's wording exactly. This was found to matter
in practice, not just in principle: Blast's canonical WBTC deployment has no logo on CoinGecko or
in LI.FI's own data, and that is a property of the asset, not a transient failure — aborting all
16 chains over it would be disproportionate, the same reasoning that already lets thin chains
land under TR-3's cap without a gap to fill.

**Verify** `live` — a full run over the 16 chains completes and its report is kept with T-4;
CoinGecko resolves the majors (ETH, USDC, USDT, DAI, WBTC, WETH) by address; a deliberately
throttled run is shown to fall through to the next source and not to record an absence; a
candidate with no logo anywhere is dropped and named in the report, and the run still completes.
**Depends on:** —

### [x] T-4 · `SWAP_TOKENS_REGISTRY` and `getCuratedSwapTokens`
**File:** `src/constants/SWAP_TOKENS_REGISTRY.ts` (new), `src/index.ts`
**Satisfies:** TR-2, TR-3, TR-4, TR-5, TR-6, TR-8, TR-9, TR-10, TR-18, TFC-2, TFC-5, TFC-6, TFC-7,
TFC-8 · **Plan:** D-3

The generated literal plus `getCuratedSwapTokens(chainId)`, which is a lookup returning a **copy**
and cannot fail — an unsupported chain is a missing key yielding `[]` (TR-9), not a branch. Header
comment records the generation date and the command, as `SWAP_SUPPORTED_CHAINS.ts` does (TR-18).
Only `getCuratedSwapTokens` is public surface; the registry constant is not exported (D-3).

**Verify** `pure`, asserted against the shipped file rather than the script's belief about it:
every id from `getSwapSupportedChainIds()` has an entry and no other chain does; no set exceeds 20
(TR-3); **exactly one** entry per chain has `isNative: true` and its address is the zero address
(TR-6); every entry carries a `logoURI` (TR-5); no address repeats within a chain; index 0 is the
native entry and the stablecoins follow it contiguously, cross-checked against
`STABLECOIN_CONTRACTS_BY_CHAIN_ID` (TR-10, TFC-8); two successive calls return equal but
**non-identical** arrays, and mutating the first does not change the second (TFC-2); an
unsupported chain and Sepolia both return `[]` without throwing (TR-9); every entry satisfies a
sentence of TR-2, audited one by one and recorded here.
`live` — every entry's address is present in `GET /v1/tokens` for its own chain (TR-18), and
**every shipped `logoURI` is fetched and answers 200** (TR-5). Separately, tokens sharing a symbol
across chains are confirmed to share `name` and `logoURI`, which is the grounds for TFC-6.
`review` — `getCuratedSwapTokens` resolves from the package entry point.
**Depends on:** T-1, T-3

---

## Public operations

### [x] T-5 · `getAllSwapTokens`
**File:** `src/swap/getAllSwapTokens.ts` (new), `src/index.ts`
**Satisfies:** TR-11, TR-13, TR-14, TR-15, TR-20, TFC-3, TFC-8 · **Plan:** D-6

Guard order: empty `chainIds` returns `{}` before anything else (TR-20); then every id is checked
against `isSwapSupportedChain` before any network access (TR-13); then `fetchTokensForChains`, then
the mapping. Any failure propagates `PROVIDER_ERROR` whole — nothing partial (TR-14). No sort is
applied anywhere (TR-15). Arrays handed back are copies, never the cached upstream ones (D-6).
Exported from `src/index.ts` (standing rule).

**Verify** `pure`, against a client that throws if invoked at all: `{ chainIds: [] }` returns `{}`
with **zero** network calls (TR-20); Sepolia, and a supported chain mixed with an unsupported one,
both raise `UNSUPPORTED_CHAIN` with **zero** network calls (TR-13); an upstream failure raises
`PROVIDER_ERROR` and the result contains no entry for the chains that were cache-served (TR-14);
duplicate ids appear once in the result; the returned order matches the upstream order element for
element, proving no sort was applied (TR-15); mutating a returned array does not affect the cache
a second call reads.
`live` — `{ chainIds: [8453, 42161] }` returns both keys populated.
`review` — `getAllSwapTokens` resolves from the package entry point.
**Depends on:** T-2

### [x] T-6 · The legacy bridge and the deprecation markers
**File:** `src/constants/BASIC_TOKENS_REGISTRY.ts`, `src/index.ts`
**Satisfies:** TR-17, TR-21, TR-22, TR-23, TFC-11, TFC-12, TFC-13 · **Plan:** D-7, D-10

`toLegacyTokenData(tokens)` returning `LegacyTokenData[]` per D-10's mapping table: `address` is
`null` for a native token (TR-23), `iconUrl` falls back to `''`, and `amount` and `usdValue` are
`''` and never invented (TR-22). `@deprecated` tags on `BASIC_TOKENS_BY_CHAIN`, `BasicTokenData`
and on `toLegacyTokenData` itself, which is deprecated from its first commit (TR-21). Nothing
else in the file changes.

**Verify** `pure` — a curated native token converts to `address: null` while a non-native keeps its
address unchanged (TR-23); a token with no `logoURI` converts to `iconUrl: ''`; `amount` and
`usdValue` are `''` for every converted token, and grep confirms no numeric or currency literal was
introduced in the mapping (TR-22); a symbol outside `BasicTokenSymbol` — `AERO` — survives the
conversion, which is the seam `LegacyTokenData` exists for (TFC-12).
`review` — **`git diff` on this file shows only added `@deprecated` annotations and the new
function**: `BASIC_TOKENS_BY_CHAIN`, `MOCK_TOKENS`, `getTokensByChain`, `BasicTokenData`,
`BasicTokenSymbol` and `ChainTokenDataMap` are byte-identical to before, which is what makes
TFC-11's "nothing breaks" a checked claim rather than an assurance. The `@deprecated` tags survive
into `dist/index.d.ts`. `toLegacyTokenData` and `LegacyTokenData` resolve from the entry point.
**Depends on:** T-1, T-4

---

## Integration

### [x] T-7 · Audit the public export surface
**File:** `src/index.ts`
**Satisfies:** TFC-1 · **Plan:** D-1, 001's D-11

Each preceding task exported its own symbols under the standing rule; this confirms the result is
complete and contains nothing more.

| Must be exported | From |
|---|---|
| `getCuratedSwapTokens` | `constants/SWAP_TOKENS_REGISTRY` |
| `getAllSwapTokens` | `swap/getAllSwapTokens` |
| `toLegacyTokenData` | `constants/BASIC_TOKENS_REGISTRY` |
| `SwapToken`, `GetAllSwapTokensParams` | `types/swap` |
| `LegacyTokenData` | `constants/BASIC_TOKENS_REGISTRY` |

Must **not** be exported: `SWAP_TOKENS_REGISTRY` itself, `fetchTokensForChains`, `toSwapToken`,
and anything else under `swap/internal/`.

**Verify** `review` — all six symbols cross-checked against `src/index.ts` and against
`dist/index.d.ts` after a full `yarn build`; `grep -n "internal/" src/index.ts` and `grep -n
"SWAP_TOKENS_REGISTRY" src/index.ts` return nothing beyond the accessor's own import.
`grep -rln "@lifi/sdk" src/` still returns exactly one file, confirming 001's D-1 isolation held
through this feature. Then, as 001's T-12 did, **import the built CJS bundle from outside the repo
tree** and confirm the three functions resolve while `fetchTokensForChains` and `toSwapToken` are
`undefined` on the barrel object.
**Depends on:** T-4, T-5, T-6

### [ ] T-8 · Prove the shared cache and the native flag against 001
**Files:** none — records land in this file
**Satisfies:** TR-12, TFC-7, TFC-4 · **Plan:** D-4, D-5

The one place 002 reaches into shipped behaviour. Two directions, both run in a single process:

1. Call `getAllSwapTokens({ chainIds: [8453] })`, then `getSwapQuote` for a pair drawn from that
   result — the quote must succeed, proving the reader populated the same cache SDK-10 validates
   against rather than a parallel one (TR-12).
2. Reverse the order — `getSwapQuote` first, then `getAllSwapTokens` for the same chain — and
   confirm the second issues **zero** network calls (TR-16 across both readers).

Then TFC-7, which is the claim that the flag means something: build a `SwapQuote` by hand whose
`fromToken.address` is a curated `isNative` entry, pass it to `buildSwapApprovalTxs`, and confirm
it returns `[]`. The token a consumer sees flagged native is the token that needs no approval.

**Verify** `live` for 1 and 2 on Base; `pure` for the `buildSwapApprovalTxs` check.
Additionally, **measure and record — do not assert — how many curated entries across all 16 chains
would fail `getSwapQuote`'s token lookup today.** TFC-4 makes curation best-effort, so a non-zero
count is not a failure of this task; it is the number that tells us whether R-1's drift is a
theoretical risk or an immediate one, and it is worth having on the day we ship rather than the
day a user finds it.
**Depends on:** T-4, T-5

### [ ] T-9 · Document the public surface
**File:** `README.md`
**Satisfies:** TFC-4, TFC-5, TFC-8, TFC-10, TFC-11, TFC-12, TFC-13 · **Plan:** public surface

A "Swap tokens" subsection under the existing Swaps section, in the same table format. Must state
explicitly, because none of it is inferable from the signatures:

- **TFC-13** — a converted legacy token must never be fed back into a swap; its native entry has
  no address while the swap path needs the zero address
- **TFC-4** — neither set promises a route; `UNSUPPORTED_TOKEN` and `NO_ROUTE` stay possible
- **TFC-5** — most of the full set has no logo (28% coverage on Base, 11% on Ethereum), and by
  TR-19 the field is absent rather than broken, so one placeholder path suffices
- **TFC-10** — the curated set changes only with a release; the full set is cached per process
- **TFC-11, TFC-12** — `BASIC_TOKENS_BY_CHAIN` still works; the bridge is deprecated on arrival and
  needs one type annotation widened
- **R-2** — logo URLs point at third-party hosts, which a strict CSP must allow

Signatures and field lists are pulled from the built `dist/*.d.ts`, not copied from plan.md, on
001's T-14 reasoning: the plan is a design-time artifact and may have drifted from what shipped.

**Verify** `review` — every documented signature matches the emitted declarations; all six
call-outs above are present.
**Depends on:** T-7

### [ ] T-10 · Release 1.8.0
**File:** `package.json`
**Satisfies:** — · **Plan:** target release

Bump `1.7.0` → `1.8.0`. Minor: the surface grows and a deprecation marker is added, but no
existing export changes type or behaviour (T-6's review check is the evidence). Run
`yarn prettier`, then `yarn build`, and confirm ESM, CJS and declarations before publishing.

Publishing is the user's step, per their standing preference. **Confirm `npm view
@octaflowlabs/onchain-sdk dist-tags` points `latest` at 1.8.0 afterwards** — 001's T-16 found
`latest` stranded on `1.0.0-test6`, so this is checked rather than assumed.

**Verify** `review` — `dist/index.d.ts` exports the full 002 surface; registry presence and the
`latest` dist-tag confirmed live against npm.
**Depends on:** T-8, T-9

---

## Clause coverage

Every clause in spec.md maps to at least one task.

| Clause | Task |
|---|---|
| TR-1 | T-1, T-2 |
| TR-2 | T-3, T-4 |
| TR-3 | T-4 |
| TR-4 | T-1, T-4 |
| TR-5 | T-3, T-4 |
| TR-6 | T-2, T-4 |
| TR-7 | T-1 |
| TR-8, TR-9, TR-10 | T-4 |
| TR-11 | T-2, T-5 |
| TR-12 | T-2, T-8 |
| TR-13, TR-14, TR-15 | T-5 |
| TR-16 | T-2, T-8 |
| TR-17 | T-6 |
| TR-18 | T-3, T-4 |
| TR-19 | T-2, T-3 |
| TR-20 | T-5 |
| TR-21, TR-22, TR-23 | T-6 |
| TFC-1 | T-7 |
| TFC-2 | T-4 |
| TFC-3 | T-5 |
| TFC-4 | T-8, T-9 |
| TFC-5 | T-4, T-9 |
| TFC-6, TFC-7 | T-4, T-8 |
| TFC-8 | T-4, T-5, T-9 |
| TFC-9 | T-1 |
| TFC-10 | T-2, T-9 |
| TFC-11, TFC-12, TFC-13 | T-6, T-9 |

**Frontend repo** — the consuming plan references this document's `§Frontend contract` items by
id, e.g. `refs sdk-spec 002 §Frontend contract, TFC-13`. The spec is not duplicated there.
