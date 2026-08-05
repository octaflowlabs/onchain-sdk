# 001 — LI.FI Swaps (EVM, same-chain)

**Status:** draft · **Owner:** SDK · **Consumers:** any client of `@octaflowlabs/onchain-sdk`

## Purpose

Let a wallet holder exchange one EVM token for another on the same chain, without the SDK
ever signing a transaction or coming into contact with a key. The SDK owns route discovery,
allowance reasoning, transaction construction and lifecycle interpretation. The consumer owns
signing, polling cadence and everything visual. Submission is shared: the consumer hands the
signed payload back to the SDK's existing generic broadcasting operation.

## Domain vocabulary

| Term | Meaning |
|---|---|
| **Quote** | A priced, time-limited offer to exchange an exact input amount for at least a guaranteed minimum output, bound to one route and one spender. |
| **Spender** | The contract the quote requires to move the input token. Named by the quote, never assumed. |
| **Approval transaction** | An unsigned ERC-20 authorization that raises the spender's allowance. |
| **Swap transaction** | The unsigned transaction that performs the exchange. |
| **Supported chain** | A chain present *both* in LI.FI's supported set *and* in the SDK's `NETWORKS_REGISTRY`. |
| **Swap state** | One of exactly five values: `approving`, `approved`, `swapping`, `done`, `error`. |
| **Native input** | The input token is the chain's native currency, not an ERC-20. |

**Error codes (closed set):** `NO_ROUTE`, `UNSUPPORTED_CHAIN`, `CROSS_CHAIN_NOT_SUPPORTED`,
`UNSUPPORTED_TOKEN`, `QUOTE_EXPIRED`, `INSUFFICIENT_ALLOWANCE`, `INVALID_SLIPPAGE`,
`EXECUTION_REVERTED`, `PROVIDER_ERROR`.

---

## SDK behavior

Internal guarantees. Each clause is one acceptance criterion.

### Amounts and safety

- **SDK-1** — THE SDK SHALL represent every token amount as an integer in the token's
  smallest unit, and SHALL NOT perform floating-point arithmetic on any amount at any point.
- **SDK-2** — THE SDK SHALL accept amounts at its boundary as decimal strings and convert
  each to an integer using the decimals of the token that amount denominates, before any
  other processing.
- **SDK-3** — THE SDK SHALL NOT accept, store, log or transmit a private key, mnemonic or
  signer, and SHALL NOT sign any transaction. Submitting an already-signed transaction is
  outside this prohibition.
- **SDK-4** — THE SDK SHALL name as spender only the address the quote designates as the
  recipient of the allowance, and SHALL NOT use a hardcoded address nor infer the spender
  from the swap transaction's destination.

### Quoting

- **SDK-5** — WHEN a quote is requested for a supported chain and a swappable token pair,
  THE SDK SHALL return the input amount, the guaranteed minimum output amount, the output
  token's address and decimals, the resolved route, the spender, and an absolute expiry
  instant set 30 seconds after the quote was produced.
- **SDK-6** — IF no route exists for the requested pair and amount, THEN the SDK SHALL fail
  with `NO_ROUTE`.
- **SDK-7** — THE SDK SHALL treat as supported only those chains present both in LI.FI's
  supported set and in `NETWORKS_REGISTRY`.
- **SDK-8** — IF the requested chain is not supported, THEN the SDK SHALL fail with
  `UNSUPPORTED_CHAIN`.
- **SDK-9** — IF the origin chain and the destination chain differ, THEN the SDK SHALL fail
  with `CROSS_CHAIN_NOT_SUPPORTED`, without attempting route discovery.
- **SDK-10** — IF either token cannot be swapped on the requested chain, THEN the SDK SHALL
  fail with `UNSUPPORTED_TOKEN`.
- **SDK-36** — WHERE the caller supplies a slippage tolerance, THE SDK SHALL apply it to route
  discovery; WHERE none is supplied, THE SDK SHALL apply a default tolerance of 0.5%.
- **SDK-37** — IF the supplied slippage tolerance is negative, zero, or above 15%, THEN the
  SDK SHALL fail with `INVALID_SLIPPAGE` without attempting route discovery.
- **SDK-38** — THE SDK SHALL accept the slippage tolerance as a percentage and SHALL convert
  it to whatever unit route discovery requires, so that no caller ever supplies a fraction.

### Approval

- **SDK-13** — WHEN approval transactions are requested, THE SDK SHALL read the current
  on-chain allowance granted to the quote's spender before producing any transaction.
- **SDK-14** — WHERE the input is native, THE SDK SHALL return an empty set of approval
  transactions.
- **SDK-15** — IF the current allowance is greater than or equal to the input amount, THEN
  the SDK SHALL return an empty set of approval transactions.
- **SDK-16** — WHEN the current allowance is zero and below the input amount, THE SDK SHALL
  return exactly one approval transaction granting an unlimited allowance to the spender.
- **SDK-17** — IF the current allowance is non-zero and below the input amount, THEN the SDK
  SHALL return exactly two ordered approval transactions: first one resetting the allowance
  to zero, then one granting an unlimited allowance.
- **SDK-18** — THE SDK SHALL address every approval transaction to the input token contract.

### Swap construction

- **SDK-19** — WHEN a swap transaction is requested with an unexpired quote, THE SDK SHALL
  return exactly one unsigned transaction whose destination, calldata and value are those
  carried by the quote.
- **SDK-20** — IF the quote's expiry instant has passed, THEN the SDK SHALL fail with
  `QUOTE_EXPIRED` and SHALL NOT return a transaction.
- **SDK-21** — IF the allowance granted to the spender is still below the input amount, THEN
  the SDK SHALL fail with `INSUFFICIENT_ALLOWANCE` and SHALL NOT return a transaction.
- **SDK-22** — WHEN returning a swap transaction, THE SDK SHALL resolve its gas limit, nonce
  and fee data so that it is ready to be signed with no further preparation.
- **SDK-23** — IF the swap transaction reverts during pre-flight simulation, THEN the SDK
  SHALL fail with `EXECUTION_REVERTED` and SHALL NOT return a transaction. Adverse price
  movement between quoting and building is one cause of such a revert: the guaranteed minimum
  output is enforced by the calldata itself, so a route that has drifted below it fails here.

### Submission

- **SDK-34** — THE SDK SHALL submit approval and swap transactions through its existing
  transaction-type-agnostic broadcasting operation, and SHALL NOT introduce a swap-specific
  submission path.

### Lifecycle reporting

- **SDK-24** — WHEN the outcome of a submitted transaction is requested, THE SDK SHALL report
  exactly one of `pending`, `success` or `failed`: `pending` while no receipt exists, `failed`
  when a receipt reports a reverted execution, `success` when a receipt reports a successful one.
- **SDK-25** — THE SDK SHALL derive the swap state from the phase supplied by the caller and
  the reported transaction outcome alone, without performing any network access, reading any
  clock, or retaining state between calls, so that identical inputs always yield an identical
  state.
- **SDK-26** — WHILE an approval transaction is submitted and its outcome is `pending`, THE
  SDK SHALL report `approving`.
- **SDK-27** — WHEN no approval is pending — because none was required, because one already
  existed, or because a submitted one reported `success` — THE SDK SHALL report `approved`.
- **SDK-28** — WHILE the swap transaction is submitted and its outcome is `pending`, THE SDK
  SHALL report `swapping`.
- **SDK-29** — THE SDK SHALL report `done` only when a receipt reporting successful execution
  exists for the swap transaction, and under no other condition.
- **SDK-30** — IF any transaction in the flow reports `failed`, THEN the SDK SHALL report
  `error`.
- **SDK-31** — IF the caller supplies a `pending` outcome, THEN the SDK SHALL report
  `approving` or `swapping` according to the supplied phase, and SHALL NOT report `done` or
  `error`. A caller unable to obtain an outcome supplies `pending`.

### Errors

- **SDK-32** — THE SDK SHALL signal every anticipated failure of the quoting, approval,
  swap-construction and lifecycle-reporting operations as a typed swap error carrying one
  code from the closed set, and SHALL NOT signal it as an untyped error.
- **SDK-33** — IF an RPC endpoint or the routing service is unreachable or returns a malformed
  response during an operation that performs network access, THEN the SDK SHALL fail with
  `PROVIDER_ERROR`. The state resolver performs no network access and therefore never raises it.
- **SDK-35** — THE SDK SHALL leave the failure behaviour of the shared broadcasting operation
  unchanged, so that submission failures continue to surface in their existing untyped form
  rather than as swap errors.

---

## Frontend contract

What the SDK guarantees to any consumer. No clause here constrains layout, copy, styling or
navigation.

- **FC-1** — The SDK exposes four operations: obtain a quote, obtain the approval
  transactions for a quote, obtain the swap transaction for a quote, and resolve the current
  swap state. No other swap surface is public.
- **FC-2** — Every transaction the SDK returns is unsigned. The consumer signs it outside the
  SDK — the SDK never receives a key or a signer — and then submits it through the SDK's
  existing broadcasting operation, which is generic and indifferent to whether the payload is
  a transfer, an approval or a swap. Submission returns the transaction hash, which is the
  handle used for all subsequent lifecycle polling.
- **FC-3** — Approval and swap are separate operations. The SDK never chains them; the
  consumer decides when each is triggered. *(Satisfies SDK-19, SDK-21.)*
- **FC-4** — The approval operation returns an ordered list of zero, one or two transactions.
  Zero means no approval is needed. When two are returned they must be broadcast in the given
  order, each confirmed before the next is sent.
- **FC-5** — The swap transaction can only be obtained once a sufficient allowance is
  effective on-chain; requesting it earlier yields `INSUFFICIENT_ALLOWANCE`.
- **FC-6** — Amounts are accepted as decimal strings and always returned as integers in the
  token's smallest unit. The consumer never receives a float.
- **FC-7** — Every quote carries an absolute expiry instant. The SDK is the sole authority on
  expiry and rejects an expired quote with `QUOTE_EXPIRED`; the consumer may read the expiry
  for its own purposes, and how it presents remaining time is a UI decision the SDK does not
  constrain.
- **FC-15** — A quote will not survive an approval. Confirming an approval routinely takes
  longer than the 30-second expiry window, so whenever a swap requires an approval the
  consumer must obtain a **fresh quote after reaching `approved`** and build the swap
  transaction from that one. The initial quote's role in that path is to determine the
  required allowance and to show an indicative price. Re-quoting is safe and cheap: approvals
  are unlimited, so a new quote never invalidates an allowance already granted. A swap that
  needs no approval can use its original quote directly.
- **FC-8** — The swap state is exactly one of `approving`, `approved`, `swapping`, `done`,
  `error`. `approved` means "no approval is pending" and covers three situations: an approval
  just succeeded, a sufficient allowance already existed, or the input is native and no
  approval applies.
- **FC-9** — The state resolver is pure. The consumer owns the phase and the transaction
  hashes, chooses the polling cadence, and the SDK neither polls, retries, nor holds progress
  between calls.
- **FC-10** — `done` is reached only on a receipt reporting successful execution. Consequently
  the consumer must not credit, debit or otherwise update any balance before observing `done`.
  An unreachable node, a missing receipt or a reverted swap never yields `done`.
- **FC-11** — Every anticipated failure of the four swap operations surfaces as a typed swap
  error carrying one code from the closed set listed in this document, and the consumer can
  branch exhaustively on that set. Failures raised while *submitting* a signed transaction are
  the exception: they come from the shared broadcasting operation and keep its existing untyped
  shape. A consumer therefore handles two error shapes across a full swap flow. How each code
  is worded to the user is a UI decision.
- **FC-12** — The set of chains on which swaps are available is published by the SDK. A chain
  outside it yields `UNSUPPORTED_CHAIN`; the consumer does not maintain its own list.
- **FC-13** — Origin and destination chain are part of the request shape, but a request where
  they differ yields `CROSS_CHAIN_NOT_SUPPORTED`. Consumers may build against both fields
  today; lifting the restriction will not change any signature.
- **FC-14** — The consumer is responsible for verifying that the wallet holds enough of the
  input token before requesting a quote. The SDK does not re-read balances and raises no
  balance-related error code.
- **FC-17** — Every public operation, type and error class named in this document is importable
  from the package entry point. A consumer never reaches into a path inside the package to
  obtain any of them. Conversely, internal modules are not exported and do not appear in the
  published type declarations: what is not in this document is not reachable, and the routing
  service the SDK talks to is never part of the consumer's import surface.
- **FC-16** — Slippage tolerance is an optional input the end user may change. It is expressed
  as a **percentage** — `0.5` means half a percent — in the one and only unit the public
  interface accepts; the SDK performs any conversion route discovery needs. Omitting it yields
  0.5%. Values outside the range above zero and up to 15% are rejected, so the consumer may
  offer any control it likes within those bounds. Presenting, labelling and defaulting that
  control in the UI is the consumer's decision.

---

## Out of scope

- **Cross-chain swaps and bridging.** Deferred to spec 003. Rejected here by SDK-9.
- **Non-EVM chains.** TRON, Solana and any other non-EVM ecosystem.
- **Signing and key handling.** Excluded by SDK-3. Broadcasting is *not* excluded: the swap
  flow reuses the SDK's existing generic broadcasting operation (SDK-34).
- **Balance verification.** Owned by the consumer (FC-14).
- **Destination-chain settlement tracking.** No LI.FI status polling in 001; same-chain
  settlement is fully determined by the swap transaction's own receipt.
- **Exact-output swaps.** Only exact-input is specified.
- **Limit orders, scheduled or recurring swaps, gasless / sponsored execution, batched
  multicall approval+swap.**
- **Fine-grained allowance policy.** Unlimited approval is deliberate for this MVP;
  exact-amount and revocation flows are a later spec.
- **Integrator fee collection and referral revenue.**
- **Testnet swaps.** No supported chain is a testnet; verification happens on low-cost
  mainnets.
- **Persisting swap history, retries, resubmission or fee bumping.**
- **Any UI concern:** token pickers, route display, confirmation screens, error copy,
  countdown rendering, analytics.

## Resolved questions

- **OQ-1** *(resolved — `SLIPPAGE_EXCEEDED` dropped)* — The code was first specified to fire at
  quote time, where it could never trigger: slippage tolerance is an input to the quote, so any
  returned route satisfies it by construction. Moving the trigger to build time was then
  considered and rejected as well: the guaranteed minimum output is enforced by the swap
  calldata itself, so a route that has drifted below it already reverts in pre-flight
  simulation and is reported by SDK-23. A separate re-pricing round-trip would have bought a
  finer-grained error name and nothing else. Adverse price movement is therefore reported as
  `EXECUTION_REVERTED`, and `SLIPPAGE_EXCEEDED` leaves the closed set.

## Retired identifiers

`SDK-11` (consumer-owned balance check), `SDK-12` and `SDK-23a` (both `SLIPPAGE_EXCEEDED`,
see OQ-1). Clause identifiers are stable once written and are never reassigned, so that
consumer references such as `refs sdk-spec §Frontend contract, FC-4` stay valid.
