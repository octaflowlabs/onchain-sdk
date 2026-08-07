# 003 — Cross-chain swaps (EVM)

**Status:** draft · **Owner:** SDK · **Consumers:** any client of `@octaflowlabs/onchain-sdk`

**Clause identifiers** — this spec numbers its clauses `CC-n` (SDK behavior) and `CFC-n` (frontend
contract). It does **not** continue 001's `SDK-n`/`FC-n` or 002's `TR-n`/`TFC-n` series: those
identifiers are stable and already referenced from the consuming repo, so reusing the numbering
would make every existing reference ambiguous. References to earlier clauses appear here in their
original form. Where this spec **amends** an earlier clause it says so by id, in
[§Amendments to 001](#amendments-to-001).

## Purpose

Lift 001's same-chain restriction: let a wallet holder exchange a token on one EVM chain for a
token on another, through the same routing service and the same signing-free division of labour.
The holder signs one swap transaction, on the origin chain, and nothing else. What 001 could not
answer — whether the funds arrived on the other side — becomes a new operation, because the origin
chain's receipt does not carry that fact and no amount of local reasoning can recover it.

Everything 001 specified for a same-chain swap continues to hold, unchanged, for a same-chain swap.

## Domain vocabulary

| Term | Meaning |
|---|---|
| **Origin chain** | The chain the input token lives on, where every transaction of the flow is signed and broadcast. |
| **Destination chain** | The chain the output token lives on. Nothing is signed there. |
| **Cross-chain swap** | A swap whose origin and destination chains differ. |
| **Same-chain swap** | A swap whose origin and destination chains are equal. Governed entirely by 001. |
| **Settlement** | The arrival, or non-arrival, of the output on the destination chain. Not observable from the origin chain's receipt. |
| **Settlement outcome** | One of exactly three values: `pending`, `success`, `failed`. |
| **Settlement report** | What the SDK returns when asked about settlement: an outcome, what was actually received, and — on `failed` — a reason. |
| **Settlement reason** | One of exactly three values, carried only on a `failed` outcome. |
| **Refund** | The routing service returned the input to the holder on the origin chain instead of delivering the output. |
| **Supported chain** | Unchanged from 001: a chain in both LI.FI's supported set and `NETWORKS_REGISTRY`. |

**Error codes (closed set, as amended by this spec):** `NO_ROUTE`, `UNSUPPORTED_CHAIN`,
`UNSUPPORTED_TOKEN`, `UNSUPPORTED_RECIPIENT`, `QUOTE_EXPIRED`, `INSUFFICIENT_ALLOWANCE`,
`INVALID_SLIPPAGE`, `EXECUTION_REVERTED`, `PROVIDER_ERROR`.

`CROSS_CHAIN_NOT_SUPPORTED` is removed. `UNSUPPORTED_RECIPIENT` is added. The set stays nine.

**Settlement reasons (closed set, new and disjoint from the above):** `refunded`,
`execution-failed`, `not-recognized`. These are carried, never raised — see CC-30 and OQ-5.

---

## Amendments to 001

Every change this spec makes to a published clause, by id. Nothing else in 001 changes.

| 001 clause | Change | Made by |
|---|---|---|
| **SDK-9** | **Retired.** Differing origin and destination chains no longer fail; they are the subject of this spec. | CC-1 |
| **SDK-8** | **Widened.** "the requested chain" becomes "either the origin or the destination chain". | CC-3 |
| **SDK-10** | **Corrected.** Each token is validated against *its own* chain's token set, not both against the origin's. The original singular wording was correct only while the two chains were required to be equal. | CC-4 |
| **SDK-29** | **Narrowed for cross-chain.** A successful receipt for the swap transaction remains sufficient for `done` on a same-chain swap and is **not** sufficient on a cross-chain one, where `done` requires a `success` settlement outcome. | CC-26 |
| **FC-10** | **Same narrowing, consumer-facing.** "`done` is reached only on a receipt reporting successful execution" holds for same-chain; for cross-chain the authority is the settlement report. The rule it exists to protect — no balance update before `done` — is unchanged and applies with more force. | CFC-10 |
| **FC-11** | **Extended.** The closed set of error codes loses one member and gains one. A second closed set — settlement reasons — is introduced alongside it, and is carried rather than raised. | CFC-15, CFC-16 |
| **FC-13** | **Honoured, not amended.** "Lifting the restriction will not change any signature" is kept: the four operations of 001 keep their names, parameters and return shapes. The restriction is lifted by removing a rejection, not by reshaping an interface. What this spec adds is one new operation. | CFC-1 |
| **SDK-25, FC-9** | **Unchanged, and deliberately so.** The state resolver stays pure — no network, no clock, no retained state. Settlement is a separate operation that performs its own network access and hands its outcome to the resolver the way `txStatus` already does. | CC-23, CFC-9 |
| **FC-8** | **Unchanged.** Exactly five states. `swapping` widens in duration, not in number. | CC-24, CFC-5 |
| **SDK-5, FC-7, FC-15** | **Unchanged.** The 30-second quote expiry and the re-quote-after-approval rule apply identically to a cross-chain quote. The expiry governs the interval between quoting and signing; settlement happens after signing, when the quote is never consulted again. | CC-8, CFC-17 |
| **SDK-24, SDK-34, SDK-35, FC-2, FC-12, FC-17** | **Unchanged.** Transaction outcome reporting, the shared broadcasting operation, its untyped failures, the published chain set and the single import path all stand as written. | CC-2, CFC-14, CFC-18 |

---

## SDK behavior

Internal guarantees. Each clause is one acceptance criterion.

### Scope of the lifted restriction

- **CC-1** — THE SDK SHALL accept a swap request whose origin and destination chains differ, and
  SHALL resolve it through the same quoting, approval and swap-construction operations it already
  applies to a request whose chains are equal.
- **CC-2** — THE SDK SHALL treat a request whose origin and destination chains are equal exactly as
  001 specifies, and SHALL NOT introduce into that path any network access, any state, any error
  code or any settlement concept this spec defines.

### Quoting across chains

- **CC-3** — IF either the origin chain or the destination chain is not a supported chain, THEN the
  SDK SHALL fail with `UNSUPPORTED_CHAIN`, without attempting route discovery.
- **CC-4** — THE SDK SHALL validate the input token against the origin chain's token set and the
  output token against the destination chain's token set; IF either token is absent from the set of
  its own chain, THEN the SDK SHALL fail with `UNSUPPORTED_TOKEN`.
- **CC-5** — IF no route exists between the requested chains for the requested pair and amount,
  THEN the SDK SHALL fail with `NO_ROUTE`. THE SDK SHALL NOT publish which pairs of supported
  chains can be bridged; `NO_ROUTE` at quote time is the only answer to that question.
- **CC-6** — IF a cross-chain swap requests a recipient other than the address supplying the input,
  THEN the SDK SHALL fail with `UNSUPPORTED_RECIPIENT`, without attempting route discovery.
- **CC-7** — THE SDK SHALL denominate a cross-chain quote's output amount and guaranteed minimum
  output amount in the destination token's own smallest unit, using the destination token's own
  decimals, so that 001's SDK-1 and SDK-2 hold across the chain boundary.
- **CC-8** — THE SDK SHALL stamp a cross-chain quote with the same absolute expiry, set the same
  interval after the quote was produced, as any other quote, and SHALL enforce it at the same point:
  when the swap transaction is built. Settlement duration SHALL NOT influence that interval.

### Approval and construction

- **CC-9** — THE SDK SHALL derive the spender, the approval transactions and the swap transaction
  of a cross-chain swap from the origin chain alone, under 001's SDK-13 through SDK-23 unchanged.
- **CC-10** — THE SDK SHALL NOT produce, require or anticipate any transaction on the destination
  chain. A cross-chain swap is signed once, on the origin chain, plus at most the two approvals
  001's SDK-17 already allows for.

### Settlement reporting

- **CC-11** — WHEN settlement is requested for a swap, identified by the hash of its origin
  transaction and the two chains it spans, THE SDK SHALL consult the routing service and return a
  settlement report carrying exactly one outcome: `pending`, `success` or `failed`.
- **CC-12** — THE SDK SHALL require nothing beyond that hash and those two chain identifiers to
  report settlement, and SHALL NOT require the quote, so that a consumer whose in-memory state was
  lost — because the application was closed and reopened — can resume reporting from what it can
  durably keep.
- **CC-13** — WHILE the routing service reports the transfer as in progress, or does not yet
  recognise the origin transaction at all, THE SDK SHALL report `pending`. Not-yet-indexed and
  does-not-exist are indistinguishable from outside and SHALL be reported identically.
- **CC-14** — WHEN the routing service reports the transfer as complete, THE SDK SHALL report
  `success`, including when the delivery differed from what was quoted.
- **CC-15** — IF the routing service reports that the input was refunded on the origin chain, THEN
  the SDK SHALL report `failed` with the reason `refunded`. Funds returned to the holder are not a
  completed swap.
- **CC-16** — IF the routing service reports the transfer as failed, THEN the SDK SHALL report
  `failed` with the reason `execution-failed`.
- **CC-17** — IF the routing service reports that it does not recognise the supplied hash as a
  transfer it can speak about, THEN the SDK SHALL report `failed` with the reason `not-recognized`,
  so that a consumer stops asking a question that has no answer.
- **CC-18** — WHEN reporting a `success` outcome, THE SDK SHALL carry the amount actually received
  and the token actually received, taken from the routing service's own account of the destination
  transaction, and SHALL NOT restate the quoted output in their place. A completion that delivered
  less than quoted, or delivered a different token than quoted, is reported by these fields and not
  by the outcome.
- **CC-19** — WHERE the routing service names the destination transaction, THE SDK SHALL carry its
  hash; WHERE it does not, the SDK SHALL omit it rather than substitute the origin transaction's.
- **CC-20** — THE SDK SHALL NOT declare a settlement failed on account of elapsed time, and SHALL
  NOT impose, publish or suggest a maximum waiting period. A transfer the routing service reports as
  in progress SHALL be reported as `pending` for as long as that remains true.
- **CC-21** — IF the routing service is unreachable or returns a malformed response while settlement
  is being reported, THEN the SDK SHALL fail with `PROVIDER_ERROR`, under 001's SDK-33.
- **CC-22** — THE SDK SHALL report settlement without polling on its own behalf and without
  retaining state between calls. Cadence and the decision to stop belong to the consumer, as 001's
  FC-9 already establishes for lifecycle reporting.

### The five states, unchanged

- **CC-23** — THE SDK SHALL continue to derive the swap state from the caller-supplied phase and
  outcome alone, without network access, without reading a clock and without retaining state, so
  that 001's SDK-25 holds unmodified. Settlement reporting is a separate operation and SHALL NOT
  become part of that derivation.
- **CC-24** — THE SDK SHALL report, for a cross-chain swap, exactly the same five states it reports
  for a same-chain one, and SHALL NOT introduce a sixth.
- **CC-25** — WHILE a cross-chain swap's settlement outcome is `pending`, THE SDK SHALL report
  `swapping`, whether or not the origin transaction has been confirmed. Confirmation of the origin
  transaction SHALL NOT end the `swapping` state.
- **CC-26** — THE SDK SHALL report `done` for a cross-chain swap only on a `success` settlement
  outcome, and under no other condition — in particular, not on a successful receipt for the origin
  transaction.
- **CC-27** — IF a cross-chain swap's settlement outcome is `failed`, THEN the SDK SHALL report
  `error`, whatever the reason accompanying it.

### Errors

- **CC-28** — THE SDK SHALL remove `CROSS_CHAIN_NOT_SUPPORTED` from the closed set of error codes
  and SHALL NOT raise it under any condition.
- **CC-29** — THE SDK SHALL add `UNSUPPORTED_RECIPIENT` to the closed set, raised by quoting alone
  and before any network access.
- **CC-30** — THE SDK SHALL express a settlement reason as a value carried by a settlement report,
  drawn from its own closed set, and SHALL NOT express it as a raised error. A settlement the SDK
  successfully read is an answer, not a failure of the operation that read it — and the closed set
  of error codes stays free of members that are never raised.

---

## Frontend contract

What the SDK guarantees to any consumer. No clause here constrains layout, copy, styling or
navigation.

- **CFC-1** — The SDK exposes **one** new operation: report the settlement of a swap. The four
  operations of 001 keep their names, their parameters and their return shapes. 001's FC-13 —
  "lifting the restriction will not change any signature" — is kept rather than corrected: a
  consumer already passing an origin and a destination chain now gets a route instead of a
  rejection, with no edit.
- **CFC-2** — A cross-chain swap is requested through the same quoting operation, with a
  destination chain that differs from the origin. There is no separate cross-chain quote.
- **CFC-3** — The recipient of a cross-chain swap is always the address that supplied the input.
  Requesting a different one yields `UNSUPPORTED_RECIPIENT` before any network call. This is a
  deliberate restriction, not a limitation of the routing service: an address that exists on the
  origin chain need not be controllable on the destination chain, and funds delivered to one that
  is not are unrecoverable.
- **CFC-4** — A cross-chain swap requires the holder to sign exactly one swap transaction, plus the
  zero, one or two approvals FC-4 already describes, **all on the origin chain**. Nothing is signed
  on the destination chain and the consumer never has to move the holder to another network
  mid-flow.
- **CFC-5** — The swap state remains exactly the five values of FC-8. What changes is duration:
  `swapping` covers seconds for a same-chain swap and minutes for a cross-chain one, spanning the
  whole interval from broadcasting the swap transaction to the funds arriving. There is no separate
  "bridging" state to handle.
- **CFC-6** — **For a cross-chain swap, the swap phase's outcome comes from the settlement report
  and from nothing else.** The consumer does not read the origin transaction's receipt during that
  phase at all: a reverted origin transaction is reported as a failed settlement (OQ-8), and a
  confirmed one reports that the funds *left*, not that they *arrived*. Feeding a successful origin
  receipt into the state resolver would yield `done` and, by FC-10's own reasoning, invite a balance
  update against money still in flight — so the single source removes the opportunity rather than
  warning about it. The origin receipt is still what the **approval** phase reads, unchanged.
- **CFC-7** — **Same-chain swaps are unchanged in every respect.** A consumer's existing 001 flow
  keeps working with no edit, performs no additional network access, and never encounters a
  settlement report. Everything in this document applies only when the two chains differ.
- **CFC-8** — Settlement is asked for with the origin transaction's hash and the two chain
  identifiers, and nothing else. It therefore survives an application restart: the only things the
  consumer must keep durably are that hash and those two chain identifiers. Whether it keeps them,
  and where, is a consumer decision the SDK does not constrain.
- **CFC-9** — The state resolver is still pure, still synchronous, and still holds no progress
  between calls. The network access settlement needs lives in an operation the consumer calls
  explicitly, exactly as it already calls the transaction-status operation — not hidden inside the
  resolver.
- **CFC-10** — `done` for a cross-chain swap means the funds arrived on the destination chain.
  FC-10's rule — no balance update before `done` — is unchanged, and matters more here than it did
  in 001: the window in which a consumer could wrongly credit an unarrived balance is now minutes
  wide rather than nonexistent.
- **CFC-11** — **A completed cross-chain swap may deliver less than quoted, or deliver a different
  token than quoted.** The settlement report carries the amount and the token actually received;
  those are what the consumer shows, not the quoted figures. This is a completion, not an error:
  the holder has funds on the destination chain. The guaranteed minimum output of 001's SDK-23 is
  enforced by the origin transaction's own calldata and therefore protects the origin leg only —
  what happens on the destination chain happens minutes later and cannot revert a transaction that
  already confirmed.
- **CFC-12** — A refunded cross-chain swap yields `error`, with the settlement reason `refunded`.
  The holder's input came back on the origin chain: nothing was exchanged and nothing was lost
  beyond fees. Distinguishing that from a genuine failure is exactly what the reason field is for;
  how it is worded to the user is a UI decision.
- **CFC-13** — The consumer owns the polling cadence and the decision to give up. The SDK publishes
  no timeout and never declares a transfer dead on elapsed time; a transfer that stays `pending`
  for hours is reported as `pending` for hours. A consumer that wants to stop asking, or to show
  the holder that something is taking unusually long, owns that policy entirely.
- **CFC-14** — The set of chains on which swaps are available is unchanged and still published by
  the SDK (FC-12). Whether a given **pair** of those chains can be bridged is not published: the
  answer is `NO_ROUTE` at quote time, and the consumer treats it as an ordinary outcome rather than
  an exceptional one.
- **CFC-15** — `CROSS_CHAIN_NOT_SUPPORTED` no longer exists. A consumer branching on it has a
  branch that can never be taken; a consumer that stored the literal in a variable typed as the
  closed set must remove it. `UNSUPPORTED_RECIPIENT` takes its place in the set and is raised only
  by quoting.
- **CFC-16** — There are now **two** closed sets, and they never cross. Error codes are *raised*,
  as FC-11 describes, and every member of that set can actually occur. Settlement reasons are
  *carried* on a failed settlement report and are never thrown. A consumer branches exhaustively on
  each in its own place: error codes in a `catch`, settlement reasons on a report it holds.
- **CFC-17** — Quote expiry is unchanged at 30 seconds, and FC-15's rule — re-quote after reaching
  `approved` — is unchanged. The expiry governs the interval between obtaining a quote and signing
  the transaction built from it; the minutes a cross-chain transfer takes elapse *after* signing,
  when the quote is never consulted again. A long settlement therefore does not need, and does not
  get, a longer quote window.
- **CFC-18** — Every operation, type and value this document names is importable from the package
  entry point and from nowhere else, as FC-17 and TFC-1 already require.

---

## Out of scope

- **Gas on the destination chain.** A holder may arrive on a chain where they hold no native
  currency to transact with. The routing service offers a mechanism for this; taking it on would
  add a second value to reason about in every quote and a second failure mode in every settlement.
  Deliberately deferred.
- **An arbitrary recipient on the destination chain.** Rejected here by CC-6. A later spec may lift
  it, and would owe the consumer a way to establish that the recipient is controllable.
- **Publishing which pairs of chains are bridgeable.** Answered by `NO_ROUTE` (CC-5, CFC-14).
- **Any timeout, deadline or stuck-transfer policy.** Excluded by CC-20 and CFC-13.
- **Recovering, claiming or re-submitting a refund.** The SDK reports that a refund happened; the
  funds are already back with the holder, and nothing further is offered.
- **Changing anything about same-chain swaps**, including using the routing service's settlement
  endpoint for them. Excluded by CC-2 and CFC-7: same-chain settlement is fully determined by the
  swap transaction's own receipt, as 001 established and verified on mainnet.
- **Persisting the origin transaction hash, or any swap history, on the SDK's behalf.** CFC-8 makes
  resumption possible; keeping the hash is the consumer's job.
- **Non-EVM chains.** The routing service bridges to Solana and others; every chain in this spec is
  EVM, as 001's supported set already is.
- **Signing and key handling.** Excluded by 001's SDK-3, unchanged. The holder still signs outside
  the SDK, and still signs only on the origin chain.
- **Balance verification**, on either chain. Owned by the consumer (FC-14).
- **Exact-output swaps, limit orders, scheduled or recurring swaps, gasless execution, batched
  approval+swap.** As in 001.
- **Fine-grained allowance policy.** Unchanged from 001: unlimited approval, on the origin chain.
- **Integrator fee collection.** As in 001.
- **Testnet swaps.** Verification happens on low-cost mainnets.
- **Any UI concern:** progress indicators, elapsed-time displays, destination-chain explorer links,
  refund messaging, network switchers.

## Resolved questions

- **OQ-5** *(resolved — a settlement reason is carried, never raised)* — The alternative was to add
  the refund case to the closed set of error codes and throw it. Rejected on two grounds. First, it
  would reproduce the defect this spec removes: `CROSS_CHAIN_NOT_SUPPORTED` is being retired
  precisely because a code that is declared but never raised makes FC-11's promise of exhaustive
  branching hollow, and a code that is raised only as a field would be the mirror image of the same
  dishonesty. Second, and decisively, a refund read successfully from the routing service is not a
  failure of the operation that read it — the operation worked. Throwing would mean the state
  resolver never produces `error` for a refund, forcing the consumer to synthesise the state
  itself and ending the resolver's standing as the single authority on state. Two disjoint closed
  sets (CFC-16) is the cost, and it is a smaller one.
- **OQ-6** *(resolved — OQ-1 is reopened by cross-chain and closed the same way)* — 001 dropped
  `SLIPPAGE_EXCEEDED` on the reasoning that the guaranteed minimum output is enforced by the swap
  calldata, so a route that drifted below it reverts in pre-flight simulation and surfaces as
  `EXECUTION_REVERTED`. That premise is same-chain only: the destination leg of a cross-chain swap
  executes minutes later, on another chain, and cannot revert an origin transaction that already
  confirmed. The question is therefore genuinely open again — and gets the same answer, for a
  different reason. A destination shortfall is reported by the amount actually received (CC-18,
  CFC-11), not by an error code: the holder has funds, the swap completed, and calling that `error`
  would put a case in which the user *received* money into the same bucket as one in which nothing
  happened. `SLIPPAGE_EXCEEDED` stays retired.
- **OQ-7** *(resolved — the recipient is forced equal to the sender)* — Allowing a different
  destination recipient is a real feature of the routing service and was rejected for this spec.
  An address that exists on the origin chain is not necessarily controllable on the destination
  chain, and funds delivered to one that is not are unrecoverable with no error anywhere in the
  flow. The wallet this SDK serves is self-custody and EOA-based, where the same address is
  controllable on every EVM chain, so the restriction costs nothing today and closes a
  loss-of-funds path that no error code could have caught after the fact.

- **OQ-8** *(resolved — the settlement report alone is authoritative)* — This clause was written
  open, requiring CFC-6 to read two sources during the swap phase until the routing service's
  answer for a **reverted origin transaction** had been measured rather than assumed. It was
  measured on 2026-08-06 against two transactions confirmed reverted on-chain first
  (`eth_getTransactionReceipt` → `status: 0x0`): both are reported as a failed transfer, with the
  destination side absent. The settlement report therefore covers an origin-side revert on its own,
  and CFC-6 collapses to a single source. That is not merely a simplification: reading the origin
  receipt during the swap phase was the only way a consumer could have obtained the successful
  origin outcome that CFC-6 forbids feeding in, so removing the second source turns a documented
  obligation into a structural impossibility. See plan.md D-3 for the raw answers and for the one
  limit on the evidence.

## Retired identifiers

`SDK-9` (cross-chain rejection at quote time — retired by CC-1) and the error code
`CROSS_CHAIN_NOT_SUPPORTED` (retired by CC-28). Clause identifiers are stable once written and are
never reassigned, so that consumer references such as `refs sdk-spec §Frontend contract, FC-4` stay
valid. A retired clause keeps its identifier and never comes back under a different meaning.

Previously retired, unchanged by this spec: `SDK-11`, `SDK-12`, `SDK-23a`.
