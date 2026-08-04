# onchain-sdk

Lightweight TypeScript SDK for EVM onchain utilities. It provides helpers for
balances, transaction building, broadcasting, gas estimation, wallet derivation,
amount formatting, and EVM same-chain swaps via LI.FI.

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

| Export | Signature | Description |
|---|---|---|
| `getBalance` | `(params: GetBalanceParams) => Promise<bigint \| undefined>` | Fetch native or ERC-20 balance for a single token on one chain. |
| `getBalances` | `(params: GetBalancesParams) => Promise<GetBalanceResult>` | Batch-fetch balances across multiple chains using Multicall3 aggregation with automatic fallback to individual calls. |

### Transactions

| Export | Signature | Description |
|---|---|---|
| `buildBaseUnsignedTransferTx` | `(params: BuildBaseUnsignedTransferTxParams) => { to, data, value }` | Build the core `to`/`data`/`value` fields for a native or ERC-20 transfer. |
| `buildUnsignedTransferTx` | `(options: BuildUnsignedTransferTxOptions) => Promise<PrepareTransactionResult>` | Build a complete unsigned transfer transaction with gas estimation. |
| `buildMaxNativeTransferTx` | `(options: BuildMaxNativeTransferTxOptions) => Promise<string>` | Calculate the maximum sendable native amount after reserving gas. |
| `estimateGasLimitFromProvider` | `(props: EstimateGasLimitFromProviderProps) => Promise<GasEstimateResult>` | Estimate gas limit with dynamic congestion-based buffering (5–30%). |
| `estimateTransaction` | `(options: EstimateTransactionOptions) => Promise<EstimateTransactionResult>` | Estimate total transaction cost including gas reserve. |
| `prepareTransaction` | `(params: PrepareTransactionParams) => Promise<PrepareTransactionResult>` | Full transaction preparation: estimation + nonce + fee data, ready for signing. |
| `broadcastTransaction` | `(options: BroadcastTransactionOptions) => Promise<string>` | Broadcast a signed transaction and optionally wait for confirmations. Returns the tx hash. |
| `txStatus` | `(options: TxStatusOptions) => Promise<TxStatusResponse>` | Check transaction status and retrieve the receipt. `TxStatusResponse.status` is `'pending' \| 'success' \| 'failed'` — feed it straight into `resolveSwapState`'s `outcome` for a submitted swap or approval transaction. |

### Provider

| Export | Signature | Description |
|---|---|---|
| `getProvider` | `(rpcUrl: string, chainId?: number) => JsonRpcProvider \| undefined` | Create an ethers `JsonRpcProvider` with optional static network. |
| `getDefaultRpc` | `(networkId: NetworkId) => string` | Return the default RPC URL for a registered network. |

### Wallet and signing

| Export | Signature | Description |
|---|---|---|
| `EvmWalletService` | `class` | HD wallet service: generate wallets, derive from mnemonic or private key, find next available index, sign messages, validate mnemonics. Accepts an `EntropySource` for randomness. |
| `createWallet` | `(privateKey: string, rpcUrl?: string) => Wallet` | Create an ethers `Wallet` instance from a private key. |
| `signMessage` | `(privateKey: string, message: string) => Promise<string>` | Sign an arbitrary message. |
| `signTransaction` | `(privateKey: string, tx: TransactionRequest, rpcUrl?: string) => Promise<string>` | Sign a transaction and return the serialized signed payload. |

### Utilities

| Export | Signature | Description |
|---|---|---|
| `formattedAmountForDisplay` | `(amount, decimals, options?) => string` | Locale-aware formatting with group separators, scientific notation for large numbers, and threshold display for tiny amounts. |
| `parsedAmount` | `(amount: string, decimals: number) => bigint` | Parse a human-readable amount string into its smallest-unit `bigint`. |
| `normalizeAddress` | `(address: string) => string` | Validate and checksum an Ethereum address. |
| `normalizeEvmAddress` | `(address: string \| null \| undefined) => string \| null` | Validate, trim, and lowercase an EVM address, returning `null` for empty or invalid values. |
| `getShortenTransactionHashOrAddress` | `(value, first?, last?) => string` | Shorten a tx hash or address (e.g. `0xAbCd…1234`). |
| `getShortenData` | `(data, first?, last?) => string` | Shorten arbitrary hex data. |
| `transformBigInt` | `(obj: ContractTransaction) => object` | Convert all `bigint` properties to strings for JSON serialization. |
| `handleErrorMessages` | `(options: { e, message }) => void` | Log structured ethers errors with detailed context. |

### Constants

| Export | Description |
|---|---|
| `GAS_LIMIT_PER_TX_TYPE` | Default gas limits: native transfer (`21 000n`), ERC-20 transfer (`65 000n`), approval (`100 000n`). |
| `MULTICALL3_ADDRESS` | Canonical Multicall3 contract address. |
| `ERC20_TOKEN_CONTRACT_ABI` | Standard ERC-20 ABI (`balanceOf`, `transfer`, `approve`, `allowance`, `decimals`, etc.). |
| `NATIVE_TOKENS` | Native token metadata by chain (ETH, BNB, POL). |

### Networks registry

The SDK ships a built-in networks registry (`NETWORKS`) covering Ethereum, BSC, Polygon, Arbitrum, and Sepolia.

| Export | Description |
|---|---|
| `NETWORKS` | `Record<NetworkId, NetworkField>` — full network config map. |
| `getNetworksByCategory` | `(category: NetworkCategory) => NetworkField[]` — filter by `popular`, `custom`, or `testnet`. |

Each `NetworkField` entry includes `id`, `name`, `chainId`, `rpcUrl`, optional `failoverRpcUrl`, `explorerUrl`, `iconUrl`, and `symbol`.

### Tokens registry

| Export | Description |
|---|---|
| `BASIC_TOKENS_BY_CHAIN` | Hardcoded ERC-20 token metadata (USDC, USDT, etc.) grouped by chain ID for Ethereum, BSC, Polygon, and Arbitrum. |

### Stablecoin registry

| Export | Description |
|---|---|
| `STABLECOIN_CONTRACTS_BY_CHAIN_ID` | Allowlisted USDC, USDT, and OSC test stablecoin contracts grouped by chain ID. |
| `getStablecoinContractsByChainId` | `(chainId) => readonly StablecoinContractData[]` — return allowlisted stablecoin metadata for one chain. |
| `getStablecoinContractBySymbolAndChainId` | `(symbol, chainId) => StablecoinContractData \| null` — resolve one allowlisted stablecoin contract by symbol and chain ID. |
| `isAllowedStablecoinContract` | `(chainId, contractAddress) => boolean` — normalize and check whether a contract is an allowlisted stablecoin on a chain. |

### Alchemy webhooks

| Export | Description |
|---|---|
| `extractPoolInboundStablecoinEvents` | `(payload, poolAddress) => PoolInboundStablecoinEvent[]` — extract inbound token transfers to a pool when the token contract is an allowlisted stablecoin. |

<!-- Satisfies FC-1, FC-2, FC-3, FC-4, FC-5, FC-6, FC-7, FC-8, FC-9, FC-10, FC-11, FC-12, FC-13, FC-14, FC-15, FC-16 -->
### Swaps

Same-chain EVM token swaps, quoted and routed through [LI.FI](https://li.fi). The SDK never
signs or broadcasts a swap transaction — every operation below returns an **unsigned**
transaction (or a list of them) that the consumer signs and submits through the SDK's existing
`broadcastTransaction`, exactly as it would for a transfer. Cross-chain requests
(`fromChainId !== toChainId`) are rejected with `CROSS_CHAIN_NOT_SUPPORTED`; only same-chain
swaps are in scope today.

| Export | Signature | Description |
|---|---|---|
| `getSwapQuote` | `(params: GetSwapQuoteParams) => Promise<SwapQuote>` | Quote a swap. The amount is a decimal string in the input token's own units (e.g. `"1.5"`); the SDK resolves decimals and converts internally. |
| `buildSwapApprovalTxs` | `(params: BuildSwapApprovalTxsParams) => Promise<TransactionRequest[]>` | Build the ERC-20 approval(s) a swap needs, given a quote. Returns `[]`, `[approve]`, or `[reset, approve]` — see notes below. |
| `buildSwapTx` | `(params: BuildSwapTxParams) => Promise<PrepareTransactionResult>` | Build the swap transaction itself: gas limit, nonce and fee data are already resolved, ready to sign. |
| `resolveSwapState` | `(params: ResolveSwapStateParams) => SwapState` | Pure function: given the current phase and a transaction outcome, returns one of `approving \| approved \| swapping \| done \| error`. No network access — before anything is submitted the caller passes `outcome: 'not-submitted'` itself; once submitted, `outcome` is `TxStatusResponse.status` from polling `txStatus`. |
| `getSwapSupportedChainIds` | `() => number[]` | Chain IDs where swaps are available: the intersection of chains LI.FI supports and chains in `NETWORKS_REGISTRY`. A quote for any other chain fails with `UNSUPPORTED_CHAIN`. |
| `SwapError` | `class extends Error` | Thrown by every swap operation on an anticipated failure. Carries `code: SwapErrorCode` (the exhaustive branch point) and an optional `details` payload. `message` is developer-facing, not UI copy. |
| `isSwapError` | `(e: unknown) => e is SwapError` | Type guard for `SwapError`. |

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

`SwapErrorCode` is a closed set: `NO_ROUTE`, `UNSUPPORTED_CHAIN`, `CROSS_CHAIN_NOT_SUPPORTED`,
`UNSUPPORTED_TOKEN`, `QUOTE_EXPIRED`, `INSUFFICIENT_ALLOWANCE`, `INVALID_SLIPPAGE`,
`EXECUTION_REVERTED`, `PROVIDER_ERROR`. A consumer can `switch` on it exhaustively.

**Five behaviors that don't show up in the signatures above, and that a consumer needs to know:**

- **A quote does not survive an approval.** Confirming an approval routinely takes longer than
  the quote's 30-second window. Whenever `buildSwapApprovalTxs` returns a non-empty list, get a
  **fresh quote** once the approval reaches `approved`, and call `buildSwapTx` with that new
  quote — not the original one. Re-quoting is safe: approvals are unlimited, so a new quote
  never invalidates an allowance already granted. A swap that needs no approval can build
  straight off its original quote.
- **Never update a balance before `done`.** `resolveSwapState` reaches `done` only from a
  receipt reporting successful execution. An unreachable node, a missing receipt, or a
  reverted swap never produce `done` — don't credit or debit anything until it does.
- **The approval list can hold two transactions.** This happens for tokens (like USDT) that
  revert an `approve` call if the current allowance is non-zero: `buildSwapApprovalTxs` then
  returns `[resetToZero, approveMax]`. Broadcast them **in that order**, and wait for the first
  to confirm before sending the second — they carry sequential nonces on the assumption the
  first lands before the second is submitted.
- **A full swap flow surfaces two different error shapes.** `getSwapQuote`,
  `buildSwapApprovalTxs` and `buildSwapTx` throw `SwapError` (typed, `.code` is exhaustive).
  Submitting a signed transaction still goes through the existing `broadcastTransaction`,
  which throws its original, untyped `Error` on failure — that path is unchanged by this
  feature. Catch both shapes across a full flow.
- **Slippage is a percentage, not a fraction.** `0.5` means half a percent, not fifty. It's
  optional, defaults to `0.5`, and must be greater than `0` and at most `15` — anything else
  throws `INVALID_SLIPPAGE` before any network call.

### Types

All interfaces and type aliases are exported for consumer use:

`BroadcastTransactionOptions`, `BuildMaxNativeTransferTxOptions`, `BuildUnsignedTransferTxOptions`, `BuildBaseUnsignedTransferTxParams`, `EstimateGasLimitFromProviderProps`, `GasEstimateResult`, `EstimateTransactionOptions`, `EstimateTransactionResult`, `PrepareTransactionParams`, `PrepareTransactionResult`, `TxStatusOptions`, `TxStatusResponse`, `FormatAmountOptions`, `TransactionRequest`, `GetBalanceParams`, `GetBalancesParams`, `GetBalancesChainRequest`, `GetBalanceResult`, `ChainBalances`, `TokenBalance`, `ChainGroup`, `NetworkField`, `NetworkId`, `NetworkCategory`, `BasicTokenData`, `BasicTokenSymbol`, `ChainTokenDataMap`, `StablecoinContractData`, `StablecoinContractsByChainId`, `StablecoinSymbol`, `EvmGeneratedWallet`, `EvmDerivedWallet`, `EntropySource`, `SwapState`, `SwapPhase`, `SwapTxOutcome`, `SwapErrorCode`, `SwapTokenInfo`, `SwapRouteSummary`, `LifiTransactionRequest`, `SwapQuote`, `GetSwapQuoteParams`, `BuildSwapApprovalTxsParams`, `BuildSwapTxParams`, `ResolveSwapStateParams`.

## Design notes

- The SDK is stateless and transport-agnostic. It expects a caller-provided RPC URL.
- Multicall3 is used automatically for batched balance queries with per-call failure handling and fallback.
- Gas estimation applies dynamic congestion-aware buffering (5–30%) based on current fee data.
- Caching, polling, and background jobs should be handled by the consumer app or backend.

## License

MIT