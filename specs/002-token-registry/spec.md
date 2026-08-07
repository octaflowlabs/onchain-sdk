# 002 — Swap token registry

**Status:** draft · **Owner:** SDK · **Consumers:** any client of `@octaflowlabs/onchain-sdk`

**Clause identifiers** — this spec numbers its clauses `TR-n` (SDK behavior) and `TFC-n`
(frontend contract). It does **not** continue 001's `SDK-n`/`FC-n` series: those identifiers are
stable and already referenced from the consuming repo, so reusing the numbering would make every
existing reference ambiguous. References to 001's clauses appear here in their original form.

## Purpose

Publish the tokens a consumer may offer for a swap, so an asset selector can be rendered without
the consumer maintaining its own token list. Two sets are published for two different jobs: a
small **curated** set per chain — what a selector shows by default — and the **full** set the
routing service supports on that chain, for search and for the "show everything" path. Neither
set is a promise about routes: what is swappable is decided at quote time by 001, not here.

## Domain vocabulary

| Term | Meaning |
|---|---|
| **Supported chain** | Unchanged from 001: a chain in both LI.FI's supported set and `NETWORKS_REGISTRY`. |
| **Curated set** | The principal tokens of one supported chain, chosen by the SDK against a stated criterion, resolved with no network access. |
| **Full set** | Every token the routing service lists for one supported chain, unfiltered. |
| **Principal token** | A token admitted to a curated set under TR-2. |
| **Published token** | Any entry of either set, expressed in the SDK's own token type. |

**Error codes:** unchanged. This feature adds none and uses two of the closed set defined in
[001 spec.md](../001-lifi-swap/spec.md): `UNSUPPORTED_CHAIN` and `PROVIDER_ERROR`.

---

## SDK behavior

Internal guarantees. Each clause is one acceptance criterion.

### The published token

- **TR-1** — THE SDK SHALL express every published token in a type it owns, and SHALL NOT expose
  the routing service's own token type, in any signature or in any published type declaration.
- **TR-2** — THE SDK SHALL admit a token to a chain's curated set only under this criterion: the
  chain's native currency; its wrapped equivalent where one exists; every stablecoin the SDK
  already recognises for that chain; and tokens with an established market on that chain. Each
  entry is auditable against this sentence, one by one.
- **TR-3** — THE SDK SHALL keep every curated set at no more than 20 tokens, so that the set stays
  the size of a selector and cannot drift toward being the full set by accretion.
- **TR-4** — THE SDK SHALL carry, for every published token, the chain it belongs to, its address,
  its decimals, its symbol, its display name, whether it is the chain's native currency, and its
  logo location where one is known.
- **TR-5** — THE SDK SHALL declare the logo location as optional, and SHALL nonetheless carry one,
  verified to resolve, on every entry of every curated set. Optional in the type because most of
  the full set has no usable logo; present in every curated entry because the curated set is the
  SDK's own to complete.
- **TR-19** — THE SDK SHALL NOT publish a logo location it knows does not resolve, and SHALL omit
  the field instead. An absent logo location therefore means "there is no logo", never "there is a
  logo that fails to load", so a consumer needs exactly one fallback path rather than two.
- **TR-6** — THE SDK SHALL mark exactly one entry per curated set as the chain's native currency,
  and SHALL give that entry the zero address, consistently with 001's SDK-14.
- **TR-7** — THE SDK SHALL NOT carry a balance, an amount, a fiat value or a price on any
  published token. None of them is a property of a token, and each would be stale the moment it
  was read from a cached list.

### Reading the curated set

- **TR-8** — WHEN a curated set is requested for a supported chain, THE SDK SHALL return it
  without performing any network access, and SHALL NOT fail.
- **TR-9** — WHEN a curated set is requested for a chain that is not supported, THE SDK SHALL
  return an empty set rather than failing, so that a synchronous reading has no failure mode at
  all.
- **TR-10** — THE SDK SHALL order every curated set: the native currency first, then the
  stablecoins, then the remaining tokens; and SHALL return the same order on every call.

### Reading the full set

- **TR-11** — WHEN the full set is requested for one or more supported chains, THE SDK SHALL
  return, for each requested chain, every token the routing service lists for it.
- **TR-12** — THE SDK SHALL apply no price, verification, popularity or any other filter when
  reading the full set, so that the published full set is exactly the set against which 001's
  SDK-10 accepts or rejects a token. A consumer that offers a token from the full set therefore
  never meets `UNSUPPORTED_TOKEN` for that token.
- **TR-13** — IF any requested chain is not a supported chain, THEN the SDK SHALL fail with
  `UNSUPPORTED_CHAIN` without performing any network access.
- **TR-14** — IF the routing service is unreachable, returns a malformed response, or omits a
  requested chain, THEN the SDK SHALL fail with `PROVIDER_ERROR` and SHALL NOT return a partial
  result for the chains it could read.
- **TR-15** — THE SDK SHALL NOT guarantee any ordering of a full set.
- **TR-16** — WHILE a chain's full set has already been read in the current process, THE SDK SHALL
  serve it from memory without further network access, and SHALL NOT persist it beyond the
  process.
- **TR-20** — WHERE no chain at all is requested, THE SDK SHALL return an empty result without
  performing any network access. Asking for nothing is not an error.

### Relationship to what already exists

- **TR-17** — THE SDK SHALL supersede `BASIC_TOKENS_BY_CHAIN` with the curated sets, and SHALL
  leave that export present and behaviourally unchanged, marked as deprecated. Removing it is a
  breaking change and is not taken here.
- **TR-21** — WHERE a consumer holds code written against the deprecated registry, THE SDK SHALL
  offer a conversion of published tokens into that registry's shape, and SHALL mark that
  conversion deprecated from the moment it is introduced. It exists to make migration incremental,
  not to be built upon.
- **TR-22** — THE SDK SHALL NOT fabricate a balance, an amount or a fiat value in a converted
  token, and SHALL leave those fields empty. TR-7 holds through the conversion: the deprecated
  shape has somewhere to put them, and that is not a reason to invent them.
- **TR-23** — THE SDK SHALL represent the native currency in a converted token as the deprecated
  shape represents it, and SHALL leave every published token's own address directly usable as an
  input to the swap operations. The conversion is therefore lossy in exactly one direction that
  matters, and TFC-13 states the consequence.
- **TR-18** — THE SDK SHALL NOT verify a curated entry against the routing service at call time.
  Curated sets are verified when they are authored and when they are edited, and that verification
  is dated; it is not re-performed per call.

---

## Frontend contract

What the SDK guarantees to any consumer. No clause here constrains layout, copy, styling or
navigation.

- **TFC-1** — The SDK exposes two operations: read the curated set of a chain, and read the full
  set of one or more chains. Both, and every type they name, are importable from the package entry
  point and from nowhere else — the same guarantee 001's FC-17 makes.
- **TFC-2** — Reading a curated set is synchronous, performs no network access and cannot fail.
  It is safe to call during rendering, offline, and before any provider is configured. An
  unsupported chain yields an empty set, never an error.
- **TFC-3** — Reading a full set is asynchronous and can fail with `UNSUPPORTED_CHAIN` or
  `PROVIDER_ERROR`, as a typed swap error of the same closed set 001 defines. Several chains may
  be requested at once; the result is all-or-nothing, so a consumer never has to reason about
  which chains came back.
- **TFC-4** — **Neither set is a promise that a swap exists.** A curated token may still yield
  `UNSUPPORTED_TOKEN` or `NO_ROUTE` at quote time: curation is the SDK's best effort, dated at
  authoring time, and the routing service's own list moves independently. The consumer handles
  those two codes exactly as 001's FC-11 already requires. A token taken from the *full* set is
  the narrower case: TR-12 makes `UNSUPPORTED_TOKEN` unreachable for it, but `NO_ROUTE` remains
  entirely possible.
- **TFC-5** — Every curated token carries a logo location that was verified to resolve. **Most of
  the full set carries none** — measured on 2026-08-05 at 28% coverage on Base and 11% on
  Ethereum, once the upstream's dead logo host is discounted (OQ-4). A consumer that renders the
  full set therefore needs a visual placeholder for the majority of entries, and needs it for the
  curated set only as defence in depth. By TR-19 the field is absent rather than broken, so one
  fallback path suffices: there is no second case where a URL is present but fails to load.
- **TFC-6** — The same token on two chains carries the same display name and the same logo
  location. A consumer may group by them to present one asset with several networks. The SDK
  publishes per chain and performs no such grouping.
- **TFC-7** — Exactly one curated token per chain is marked as the chain's native currency. That
  is the token for which 001's approval step returns an empty list (SDK-14), so the consumer can
  tell before quoting whether a swap will involve an approval at all.
- **TFC-8** — A curated set may be rendered in the order returned: native first, then stablecoins,
  then the rest, stable across calls. A full set carries no meaningful order — the upstream list
  is not ranked by relevance — so a consumer that renders it must impose its own ordering.
- **TFC-9** — No published token carries a balance, an amount or a price. The consumer joins these
  sets with the SDK's existing balance reading; nothing here duplicates it.
- **TFC-10** — Curated sets change only with a release of this package. A full set is read once per
  chain per process and served from memory thereafter, so a long-lived process will not observe a
  token added upstream until it restarts. Neither set is persisted.
- **TFC-11** — `BASIC_TOKENS_BY_CHAIN` is deprecated by this feature. It keeps working unchanged;
  its `amount` and `usdValue` fields were demo data and have no successor here, by TR-7. Consumers
  migrate to the curated sets. **Nothing in this feature breaks an existing consumer**: every
  export that existed before it still exists, with the same type and the same contents.
- **TFC-12** — A conversion into the deprecated registry's shape is published for consumers whose
  components are already written against it. It is a migration bridge, deprecated on arrival, and
  it is lossy: balances and fiat values come back empty (TR-22), and its symbol is an ordinary
  string rather than the deprecated closed union, because real token symbols do not fit that
  union. It is a drop-in at runtime and a one-line type change at compile time.
- **TFC-13** — **A converted token must not be fed back into a swap.** The deprecated shape carries
  the native currency with no address, while the swap operations identify it by the zero address —
  so a converted native token silently yields `UNSUPPORTED_TOKEN` rather than failing loudly. The
  conversion is for rendering; quoting is done with the published token, whose address is always
  directly usable.

---

## Out of scope

- **Cross-chain grouping.** TFC-6 gives the consumer what it needs to group; the SDK does not ship
  a grouped shape. Revisit if two consumers implement the same grouping.
- **Prices, balances, fiat values and portfolio state.** Excluded by TR-7 and TFC-9.
- **Search, ranking, pagination and fuzzy matching** over either set. The consumer owns them.
- **Cache invalidation and forced refresh.** TR-16's cache has no public escape hatch in this
  spec. If a long-lived consumer needs one, it is a later, additive change.
- **Arbitrary token lookup by address** for a token in neither set. 001's quote path already
  answers that question authoritatively with `UNSUPPORTED_TOKEN`.
- **Token verification, spam filtering or risk scoring.** The routing service's verification signal
  is deliberately unused — see OQ-2.
- **Custom or user-added tokens**, and any persistence of them.
- **Hosting, proxying, caching or bundling logo images.** The SDK publishes locations, never
  bytes. Serving them from infrastructure we control is a real answer to OQ-4's failure mode and a
  far larger commitment than this feature.
- **Non-EVM chains**, and any chain outside 001's supported set.
- **Testnet tokens.**
- **Removing `BASIC_TOKENS_BY_CHAIN`.** Deprecation only (TR-17); removal belongs to a major, and
  it takes TR-21's conversion with it.
- **Converting in the other direction**, from the deprecated shape back into a published token.
  The bridge carries consumers forward only.
- **Any UI concern:** selector layout, logo fallbacks, empty states, search boxes, network
  switchers.

## Resolved questions

- **OQ-2** *(resolved — no upstream signal defines "principal", so the SDK curates)* — Three
  upstream signals were measured against `GET /v1/tokens` on 2026-08-05 before writing TR-2, and
  all three were rejected. **`minPriceUSD` filters by unit price, not by relevance**: on Base it
  takes 946 tokens to 711 at `0.01`, while the head of the filtered list is still `RX` at
  \$22,197 and `$COOL` at \$6,509 — noise with a high unit price survives, and legitimately cheap
  tokens are what it removes. **`verificationStatus`** is absent from the installed package's
  types and leaves 4,024 of Ethereum's 5,321 tokens standing. **`coinKey`** is present on 404 of
  Base's 946 and includes vault and principal-token wrappers; it is an upstream key, not a
  quality mark. Curation under a stated criterion (TR-2) is therefore the SDK's own
  responsibility, and TR-18 states plainly what that costs.
- **OQ-4** *(resolved — a published logo location is verified, not copied)* — The upstream's
  dominant logo host is dead. Measured on 2026-08-05: `storage.googleapis.com/zapper-fi-assets`
  answers every request with HTTP 403 `UserProjectAccountProblem — the billing account for the
  owning project is disabled`, identically for a browser user agent, so it is neither rate
  limiting nor referrer filtering. It accounts for 214 of Base's 481 logo locations and 1,727 of
  Ethereum's 2,338, which is what takes real coverage down to 28% and 11%. The project behind it
  is winding down, so this will not recover. Two consequences, both now clauses: a curated entry
  carries a location only after it has been fetched and answered (TR-5), and a location known not
  to resolve is dropped rather than passed through (TR-19). Which sources are tried, and in what
  order, is a technical decision and belongs to plan.md.
- **OQ-3** *(resolved — the full set is never filtered)* — Filtering the full set at the point it
  is read would change the set 001's SDK-10 validates against, since both readings share one
  upstream list. A consumer could then be handed a token the SDK itself would reject at quote
  time, or the reverse. TR-12 makes the published full set and the validation set the same set by
  construction, which is why the filtering question is answered once, here, and not per call site.
