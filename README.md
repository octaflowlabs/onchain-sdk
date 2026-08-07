# onchain-sdk

Lightweight TypeScript SDK for EVM onchain utilities. It provides helpers for
balances, transaction building, broadcasting, gas estimation, wallet derivation,
amount formatting, and same-chain and cross-chain EVM swaps via LI.FI.

## Install

```bash
npm install @octaflowlabs/onchain-sdk
# or
yarn add @octaflowlabs/onchain-sdk
```

## How to use

```ts
import {
  getProvider,
  getBalance,
  buildUnsignedTransferTx,
  broadcastTransaction,
} from '@octaflowlabs/onchain-sdk'
```

- Provide a valid RPC URL (public or private) and the target chain ID.
- Call the balance, transaction, or signing helpers based on your flow.
- Handle errors at the call site and decide how often to poll or refresh.

## API reference

### Balances

| Export        | Signature                                                    | Description                                                                                                           |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `getBalance`  | `(params: GetBalanceParams) => Promise<bigint \| undefined>` | Fetch native or ERC-20 balance for a single token on one chain.                                                       |
| `getBalances` | `(params: GetBalancesParams) => Promise<GetBalanceResult>`   | Batch-fetch balances across multiple chains using Multicall3 aggregation with automatic fallback to individual calls. |

### Transactions

| Export                         | Signature                                                                        | Description                                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildBaseUnsignedTransferTx`  | `(params: BuildBaseUnsignedTransferTxParams) => { to, data, value }`             | Build the core `to`/`data`/`value` fields for a native or ERC-20 transfer.                                                                                                                                                |
| `buildUnsignedTransferTx`      | `(options: BuildUnsignedTransferTxOptions) => Promise<PrepareTransactionResult>` | Build a complete unsigned transfer transaction with gas estimation.                                                                                                                                                       |
| `buildMaxNativeTransferTx`     | `(options: BuildMaxNativeTransferTxOptions) => Promise<string>`                  | Calculate the maximum sendable native amount after reserving gas.                                                                                                                                                         |
| `estimateGasLimitFromProvider` | `(props: EstimateGasLimitFromProviderProps) => Promise<GasEstimateResult>`       | Estimate gas limit with dynamic congestion-based buffering (5–30%).                                                                                                                                                       |
| `estimateTransaction`          | `(options: EstimateTransactionOptions) => Promise<EstimateTransactionResult>`    | Estimate total transaction cost including gas reserve.                                                                                                                                                                    |
| `prepareTransaction`           | `(params: PrepareTransactionParams) => Promise<PrepareTransactionResult>`        | Full transaction preparation: estimation + nonce + fee data, ready for signing.                                                                                                                                           |
| `broadcastTransaction`         | `(options: BroadcastTransactionOptions) => Promise<string>`                      | Broadcast a signed transaction and optionally wait for confirmations. Returns the tx hash.                                                                                                                                |
| `txStatus`                     | `(options: TxStatusOptions) => Promise<TxStatusResponse>`                        | Check transaction status and retrieve the receipt. `TxStatusResponse.status` is `'pending' \| 'success' \| 'failed'` — feed it straight into `resolveSwapState`'s `outcome` for a submitted swap or approval transaction. |

### Provider

| Export          | Signature                                                            | Description                                                      |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `getProvider`   | `(rpcUrl: string, chainId?: number) => JsonRpcProvider \| undefined` | Create an ethers `JsonRpcProvider` with optional static network. |
| `getDefaultRpc` | `(networkId: NetworkId) => string`                                   | Return the default RPC URL for a registered network.             |

### Wallet and signing

| Export             | Signature                                                                          | Description                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EvmWalletService` | `class`                                                                            | HD wallet service: generate wallets, derive from mnemonic or private key, find next available index, sign messages, validate mnemonics. Accepts an `EntropySource` for randomness. |
| `createWallet`     | `(privateKey: string, rpcUrl?: string) => Wallet`                                  | Create an ethers `Wallet` instance from a private key.                                                                                                                             |
| `signMessage`      | `(privateKey: string, message: string) => Promise<string>`                         | Sign an arbitrary message.                                                                                                                                                         |
| `signTransaction`  | `(privateKey: string, tx: TransactionRequest, rpcUrl?: string) => Promise<string>` | Sign a transaction and return the serialized signed payload.                                                                                                                       |

### Utilities

| Export                               | Signature                                                  | Description                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `formattedAmountForDisplay`          | `(amount, decimals, options?) => string`                   | Locale-aware formatting with group separators, scientific notation for large numbers, and threshold display for tiny amounts. |
| `parsedAmount`                       | `(amount: string, decimals: number) => bigint`             | Parse a human-readable amount string into its smallest-unit `bigint`.                                                         |
| `normalizeAddress`                   | `(address: string) => string`                              | Validate and checksum an Ethereum address.                                                                                    |
| `normalizeEvmAddress`                | `(address: string \| null \| undefined) => string \| null` | Validate, trim, and lowercase an EVM address, returning `null` for empty or invalid values.                                   |
| `getShortenTransactionHashOrAddress` | `(value, first?, last?) => string`                         | Shorten a tx hash or address (e.g. `0xAbCd…1234`).                                                                            |
| `getShortenData`                     | `(data, first?, last?) => string`                          | Shorten arbitrary hex data.                                                                                                   |
| `transformBigInt`                    | `(obj: ContractTransaction) => object`                     | Convert all `bigint` properties to strings for JSON serialization.                                                            |
| `handleErrorMessages`                | `(options: { e, message }) => void`                        | Log structured ethers errors with detailed context.                                                                           |

### Constants

| Export                     | Description                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GAS_LIMIT_PER_TX_TYPE`    | Default gas limits: native transfer (`21 000n`), ERC-20 transfer (`65 000n`), approval (`100 000n`). |
| `MULTICALL3_ADDRESS`       | Canonical Multicall3 contract address.                                                               |
| `ERC20_TOKEN_CONTRACT_ABI` | Standard ERC-20 ABI (`balanceOf`, `transfer`, `approve`, `allowance`, `decimals`, etc.).             |
| `NATIVE_TOKENS`            | Native token metadata by chain (ETH, BNB, POL).                                                      |

### Networks registry

The SDK ships a built-in networks registry (`NETWORKS`) covering Ethereum, BSC, Polygon, Arbitrum, and Sepolia.

| Export                  | Description                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `NETWORKS`              | `Record<NetworkId, NetworkField>` — full network config map.                                   |
| `getNetworksByCategory` | `(category: NetworkCategory) => NetworkField[]` — filter by `popular`, `custom`, or `testnet`. |

Each `NetworkField` entry includes `id`, `name`, `chainId`, `rpcUrl`, optional `failoverRpcUrl`, `explorerUrl`, `iconUrl`, and `symbol`.

### Tokens registry

| Export                  | Description                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `BASIC_TOKENS_BY_CHAIN` | Hardcoded ERC-20 token metadata (USDC, USDT, etc.) grouped by chain ID for Ethereum, BSC, Polygon, and Arbitrum. |

### Stablecoin registry

| Export                                    | Description                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `STABLECOIN_CONTRACTS_BY_CHAIN_ID`        | Allowlisted USDC, USDT, and OSC test stablecoin contracts grouped by chain ID.                                              |
| `getStablecoinContractsByChainId`         | `(chainId) => readonly StablecoinContractData[]` — return allowlisted stablecoin metadata for one chain.                    |
| `getStablecoinContractBySymbolAndChainId` | `(symbol, chainId) => StablecoinContractData \| null` — resolve one allowlisted stablecoin contract by symbol and chain ID. |
| `isAllowedStablecoinContract`             | `(chainId, contractAddress) => boolean` — normalize and check whether a contract is an allowlisted stablecoin on a chain.   |

### Alchemy webhooks

| Export                               | Description                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractPoolInboundStablecoinEvents` | `(payload, poolAddress) => PoolInboundStablecoinEvent[]` — extract inbound token transfers to a pool when the token contract is an allowlisted stablecoin. |

<!-- Satisfies FC-1, FC-2, FC-3, FC-4, FC-5, FC-6, FC-7, FC-8, FC-9, FC-10, FC-11, FC-12, FC-13, FC-14, FC-15, FC-16, CFC-1, CFC-2, CFC-3, CFC-4, CFC-5, CFC-6, CFC-7, CFC-8, CFC-9, CFC-10, CFC-11, CFC-12, CFC-13, CFC-14, CFC-15, CFC-16, CFC-17, CFC-18 -->

### Swaps

EVM token swaps, quoted and routed through [LI.FI](https://li.fi) — same-chain and cross-chain
alike. The SDK never signs or broadcasts a swap transaction — every operation below returns an
**unsigned** transaction (or a list of them) that the consumer signs and submits through the
SDK's existing `broadcastTransaction`, exactly as it would for a transfer. A cross-chain swap
(`fromChainId !== toChainId`) is signed **once, on the origin chain** — nothing is signed on the
destination chain, and the consumer never moves the holder to another network mid-flow.
**Same-chain swaps are unchanged in every respect**: the flow that worked before this release
needs no edit, performs no extra network access, and never calls `getSwapSettlement`.

| Export                     | Signature                                                               | Description                                                                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getSwapQuote`             | `(params: GetSwapQuoteParams) => Promise<SwapQuote>`                    | Quote a swap. The amount is a decimal string in the input token's own units (e.g. `"1.5"`); the SDK resolves decimals and converts internally. Works identically whether `fromChainId` and `toChainId` match or differ.                                                                                    |
| `buildSwapApprovalTxs`     | `(params: BuildSwapApprovalTxsParams) => Promise<TransactionRequest[]>` | Build the ERC-20 approval(s) a swap needs, given a quote. Returns `[]`, `[approve]`, or `[reset, approve]` — see notes below. Always on the **origin** chain, cross-chain included.                                                                                                                        |
| `buildSwapTx`              | `(params: BuildSwapTxParams) => Promise<PrepareTransactionResult>`      | Build the swap transaction itself: gas limit, nonce and fee data are already resolved, ready to sign. Always on the **origin** chain, cross-chain included.                                                                                                                                                |
| `resolveSwapState`         | `(params: ResolveSwapStateParams) => SwapState`                         | Pure function: given the current phase and a transaction outcome, returns one of `approving \| approved \| swapping \| done \| error`. No network access — see below for what outcome to feed it, which differs for a cross-chain swap.                                                                    |
| `getSwapSettlement`        | `(params: GetSwapSettlementParams) => Promise<SwapSettlementReport>`    | **Cross-chain only.** Reports whether the funds arrived on the destination chain — the origin transaction's own receipt cannot answer that. Identified by the origin tx hash and both chain IDs; no quote required, so it survives a page reload or app restart.                                           |
| `getSwapSupportedChainIds` | `() => number[]`                                                        | Chain IDs where swaps are available: the intersection of chains LI.FI supports and chains in `NETWORKS_REGISTRY`. A quote naming any other chain, as origin or destination, fails with `UNSUPPORTED_CHAIN`. Says nothing about which _pairs_ can be bridged — that's answered by `NO_ROUTE` at quote time. |
| `SwapError`                | `class extends Error`                                                   | Thrown by every swap operation on an anticipated failure. Carries `code: SwapErrorCode` (the exhaustive branch point) and an optional `details` payload. `message` is developer-facing, not UI copy.                                                                                                       |
| `isSwapError`              | `(e: unknown) => e is SwapError`                                        | Type guard for `SwapError`.                                                                                                                                                                                                                                                                                |

`SwapQuote` is the value the consumer holds between steps and passes back into
`buildSwapApprovalTxs` and `buildSwapTx`:

```ts
interface SwapQuote {
  fromChainId: number
  toChainId: number
  fromToken: SwapTokenInfo // { address, decimals, symbol }
  toToken: SwapTokenInfo
  fromAmount: bigint
  toAmount: bigint
  toAmountMin: bigint // guaranteed by the swap calldata itself
  slippagePercent: number // e.g. 0.5 means 0.5%
  spender: string // the address to approve — always this, never the tx `to`
  expiresAt: number // epoch ms; the quote is 30s old at most
  route: { tool: string; toolName: string; steps: number }
  raw: LifiTransactionRequest // opaque; consumed internally by buildSwapTx
}
```

`fromChainId` and `toChainId` may differ — that's a cross-chain quote, requested through this
same operation, with no separate cross-chain path. `getSwapSettlement`'s report has its own
shape:

```ts
interface SwapSettlementReport {
  outcome: 'pending' | 'success' | 'failed'
  reason?: 'refunded' | 'execution-failed' | 'not-recognized' // present only when outcome is 'failed'
  receivedAmount?: bigint // present only when outcome is 'success'; never the quoted figure
  receivedToken?: SwapTokenInfo // present only when outcome is 'success'; may differ from the quote
  destinationTxHash?: string // present only when the router names one
}
```

`SwapErrorCode` is a closed set: `NO_ROUTE`, `UNSUPPORTED_CHAIN`, `UNSUPPORTED_TOKEN`,
`UNSUPPORTED_RECIPIENT`, `QUOTE_EXPIRED`, `INSUFFICIENT_ALLOWANCE`, `INVALID_SLIPPAGE`,
`EXECUTION_REVERTED`, `PROVIDER_ERROR`. A consumer can `switch` on it exhaustively.
`SwapSettlementReport.reason` is a **second, disjoint** closed set — `refunded`,
`execution-failed`, `not-recognized` — that is never thrown; it only ever arrives as a field on
a report the consumer already holds. A full cross-chain flow branches on three things, not two:
`SwapError.code` (caught), `broadcastTransaction`'s untyped `Error` (caught), and
`SwapSettlementReport.reason` (read off a value).

**Behaviors that don't show up in the signatures above, and that a consumer needs to know:**

- **A quote does not survive an approval.** Confirming an approval routinely takes longer than
  the quote's 30-second window. Whenever `buildSwapApprovalTxs` returns a non-empty list, get a
  **fresh quote** once the approval reaches `approved`, and call `buildSwapTx` with that new
  quote — not the original one. Re-quoting is safe: approvals are unlimited, so a new quote
  never invalidates an allowance already granted. A swap that needs no approval can build
  straight off its original quote. This is unchanged for a cross-chain swap: the expiry governs
  the interval between quoting and signing, and settlement — which happens after signing —
  never touches the quote again, however long it takes.
- **Never update a balance before `done` — and what produces `done` differs by swap kind.** For
  a **same-chain** swap, `resolveSwapState` reaches `done` only from a receipt reporting
  successful execution of the swap transaction; an unreachable node, a missing receipt, or a
  reverted swap never produce it. For a **cross-chain** swap, a successful receipt for that same
  transaction means only that the funds _left_ the origin chain — `done` requires
  `getSwapSettlement` to report `success`. Concretely: while the origin transaction is
  unconfirmed, feed `resolveSwapState` its own outcome; once it confirms, stop polling it and
  switch to feeding the outcome from `getSwapSettlement` instead. A successful origin-transaction
  outcome must never reach the resolver for a cross-chain swap — doing so reaches `done` while
  the money is still in flight.
- **The approval list can hold two transactions.** This happens for tokens (like USDT) that
  revert an `approve` call if the current allowance is non-zero: `buildSwapApprovalTxs` then
  returns `[resetToZero, approveMax]`. Broadcast them **in that order**, and wait for the first
  to confirm before sending the second — they carry sequential nonces on the assumption the
  first lands before the second is submitted. Always on the origin chain, cross-chain included.
- **Slippage is a percentage, not a fraction.** `0.5` means half a percent, not fifty. It's
  optional, defaults to `0.5`, and must be greater than `0` and at most `15` — anything else
  throws `INVALID_SLIPPAGE` before any network call.
- **A cross-chain quote can only deliver to the address that supplied the input.** Naming a
  different `toAddress` on a cross-chain request throws `UNSUPPORTED_RECIPIENT` before any
  network call — deliberately: an address that exists on the origin chain isn't necessarily
  controllable on the destination chain, and funds delivered to one that isn't are unrecoverable.
- **Persist the origin transaction hash and both chain IDs once the swap transaction is
  broadcast.** That's the entire state `getSwapSettlement` needs — no quote, nothing else — so a
  page reload or app restart can resume reporting settlement with no other memory.
- **A completed cross-chain swap may deliver less than quoted, or a different token entirely.**
  Bridging can fall back to handing over the bridged asset itself when the destination-side swap
  can't be completed. Render `receivedAmount` / `receivedToken` from the settlement report, never
  the quoted figures — the quote's guaranteed minimum output protects only the origin leg; the
  destination leg executes minutes later, on another chain, and nothing there can revert a swap
  transaction that already confirmed.
- **A refund reports `error` with reason `refunded`, not a partial success.** The input came back
  on the origin chain instead of being exchanged — nothing was lost beyond fees, and nothing was
  delivered either.
- **There is no timeout.** The SDK never declares a transfer dead on elapsed time and publishes
  no maximum wait — a transfer stuck for hours is reported `pending` for hours, for as long as
  that stays true upstream. Poll no more than once every 5–10 seconds and back off on
  `PROVIDER_ERROR`: the routing service is unauthenticated and sustained polling is the one thing
  in a healthy cross-chain swap likely to hit a rate limit.
- **`CROSS_CHAIN_NOT_SUPPORTED` no longer exists.** A `case` for it no longer compiles against
  this version — delete it. `UNSUPPORTED_RECIPIENT` takes its place in the closed set, described
  above.
- **A full swap flow surfaces two different error shapes, same-chain or cross-chain.**
  `getSwapQuote`, `buildSwapApprovalTxs`, `buildSwapTx` and `getSwapSettlement` throw `SwapError`
  (typed, `.code` is exhaustive). Submitting a signed transaction still goes through the existing
  `broadcastTransaction`, which throws its original, untyped `Error` on failure — that path is
  unchanged. Catch both shapes across a full flow.

<!-- Satisfies TR-1 .. TR-23, TFC-1 .. TFC-13 (spec 002-token-registry) -->

#### Swap tokens

Two published token lists, for the assets a selector offers rather than the swap itself: a small
**curated** set per chain (native currency, its wrapped equivalent, recognised stablecoins, and a
few majors with an established market — at most 20 entries), and the **full** set the router
supports on that chain, unfiltered. Both are expressed in the SDK's own `SwapToken` type — never
the router's own token shape.

| Export                 | Signature                                                                  | Description                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getCuratedSwapTokens` | `(chainId: number) => SwapToken[]`                                         | Synchronous, no network access, cannot fail. An unsupported chain returns `[]`. Ordered: native currency first, then stablecoins, then the rest — stable across calls.                                                                                                                                          |
| `getAllSwapTokens`     | `(params: GetAllSwapTokensParams) => Promise<Record<number, SwapToken[]>>` | Every token the router lists for one or more chains, keyed by chain ID. An unsupported chain throws `UNSUPPORTED_CHAIN` before any network call; an upstream failure throws `PROVIDER_ERROR` for the whole call — never a partial result. No ordering is guaranteed. Cached per chain for the process lifetime. |
| `toLegacyTokenData`    | `(tokens: SwapToken[]) => LegacyTokenData[]` **(deprecated)**              | Converts published tokens into the shape `BASIC_TOKENS_BY_CHAIN` already uses, for consumers migrating incrementally. Deprecated from introduction — new code should use `SwapToken` directly.                                                                                                                  |

```ts
interface SwapToken {
  chainId: number
  address: string
  decimals: number
  symbol: string
  name: string
  isNative: boolean
  logoURI?: string // present on every curated entry; absent, not broken, on most of the full set
}
```

**Six behaviors that don't show up in the signatures above, and that a consumer needs to know:**

- **Neither list is a promise that a swap exists.** A curated or full-set token can still yield
  `UNSUPPORTED_TOKEN` or `NO_ROUTE` from `getSwapQuote` — curation is best-effort, dated at
  authoring time, and the router's own list moves independently. Handle both codes regardless of
  which list a token came from.
- **Most of the full set has no logo.** Measured coverage: 28% on Base, 11% on Ethereum. A
  missing `logoURI` means exactly that — no logo — never "a logo that failed to load"; one
  placeholder path covers every case. Every curated entry carries a working one.
- **The curated set only changes with a package release.** The full set is fetched once per
  chain per process and served from memory after that — a long-lived tab will not see a token
  added upstream until it reloads.
- **`BASIC_TOKENS_BY_CHAIN` still works, unchanged, and is deprecated.** `toLegacyTokenData` is
  a migration bridge, not a new foundation: its `symbol` is a plain `string` (real symbols like
  `AERO` don't fit the old closed union), so a consumer typed against `BasicTokenData` widens one
  annotation to `LegacyTokenData` and nothing else changes. `amount` and `usdValue` come back as
  `''` — never fabricated.
- **A token converted with `toLegacyTokenData` must not be fed back into a swap.** The legacy
  shape represents the native currency with `address: null`; `getSwapQuote` and the approval step
  identify native by the zero address instead, so a converted native token silently fails as
  `UNSUPPORTED_TOKEN`. Use the original `SwapToken` for quoting; the conversion is for rendering
  only.
- **Logo URLs point at hosts this SDK doesn't control** (`coin-images.coingecko.com`,
  `static.debank.com`, `raw.githubusercontent.com`). A selector rendering them directly needs a
  CSP that allows those hosts.

### Types

All interfaces and type aliases are exported for consumer use:

`BroadcastTransactionOptions`, `BuildMaxNativeTransferTxOptions`, `BuildUnsignedTransferTxOptions`, `BuildBaseUnsignedTransferTxParams`, `EstimateGasLimitFromProviderProps`, `GasEstimateResult`, `EstimateTransactionOptions`, `EstimateTransactionResult`, `PrepareTransactionParams`, `PrepareTransactionResult`, `TxStatusOptions`, `TxStatusResponse`, `FormatAmountOptions`, `TransactionRequest`, `GetBalanceParams`, `GetBalancesParams`, `GetBalancesChainRequest`, `GetBalanceResult`, `ChainBalances`, `TokenBalance`, `ChainGroup`, `NetworkField`, `NetworkId`, `NetworkCategory`, `BasicTokenData`, `BasicTokenSymbol`, `ChainTokenDataMap`, `StablecoinContractData`, `StablecoinContractsByChainId`, `StablecoinSymbol`, `EvmGeneratedWallet`, `EvmDerivedWallet`, `EntropySource`, `SwapState`, `SwapPhase`, `SwapTxOutcome`, `SwapErrorCode`, `SwapTokenInfo`, `SwapRouteSummary`, `LifiTransactionRequest`, `SwapQuote`, `SwapSettlementOutcome`, `SwapSettlementReason`, `SwapSettlementReport`, `GetSwapQuoteParams`, `BuildSwapApprovalTxsParams`, `BuildSwapTxParams`, `ResolveSwapStateParams`, `SwapToken`, `GetAllSwapTokensParams`, `GetSwapSettlementParams`, `LegacyTokenData`.

## Design notes

- The SDK is stateless and transport-agnostic. It expects a caller-provided RPC URL.
- Multicall3 is used automatically for batched balance queries with per-call failure handling and fallback.
- Gas estimation applies dynamic congestion-aware buffering (5–30%) based on current fee data.
- Caching, polling, and background jobs should be handled by the consumer app or backend.

## License

MIT
