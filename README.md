# onchain-sdk

Lightweight TypeScript SDK for EVM onchain utilities. It provides helpers for
balances, transaction building, broadcasting, gas estimation, wallet derivation,
and amount formatting.

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
| `txStatus` | `(options: TxStatusOptions) => Promise<TxStatusResponse>` | Check transaction status and retrieve the receipt. |

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

### Types

All interfaces and type aliases are exported for consumer use:

`BroadcastTransactionOptions`, `BuildMaxNativeTransferTxOptions`, `BuildUnsignedTransferTxOptions`, `BuildBaseUnsignedTransferTxParams`, `EstimateGasLimitFromProviderProps`, `GasEstimateResult`, `EstimateTransactionOptions`, `EstimateTransactionResult`, `PrepareTransactionParams`, `PrepareTransactionResult`, `TxStatusOptions`, `TxStatusResponse`, `FormatAmountOptions`, `TransactionRequest`, `GetBalanceParams`, `GetBalancesParams`, `GetBalancesChainRequest`, `GetBalanceResult`, `ChainBalances`, `TokenBalance`, `ChainGroup`, `NetworkField`, `NetworkId`, `NetworkCategory`, `BasicTokenData`, `BasicTokenSymbol`, `ChainTokenDataMap`, `EvmGeneratedWallet`, `EvmDerivedWallet`, `EntropySource`.

## Design notes

- The SDK is stateless and transport-agnostic. It expects a caller-provided RPC URL.
- Multicall3 is used automatically for batched balance queries with per-call failure handling and fallback.
- Gas estimation applies dynamic congestion-aware buffering (5–30%) based on current fee data.
- Caching, polling, and background jobs should be handled by the consumer app or backend.

## License

MIT