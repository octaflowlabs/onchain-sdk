# onchain-sdk

Lightweight TypeScript SDK for EVM onchain utilities. It provides helpers for
balances, transaction building, broadcasting, gas estimation, and wallet
derivation.

## Install

Install with npm or yarn.

## How to use

- Add the package to the project and import the helpers needed.
- Provide a valid RPC URL (public or private) and the target chain ID.
- Call the balance, transaction, or signing helpers based on your flow.
- Handle errors at the call site and decide how often to poll or refresh.

## What this SDK provides

Balances

- Fetch native token balances for an address.
- Fetch ERC-20 token balances for an address.
- Fetch multiple token balances across multiple chains with multicall batching.

Transactions

- Build unsigned native or ERC-20 transfer transactions.
- Estimate gas limits and fee data from a provider.
- Broadcast signed transactions.
- Check transaction status and receipt confirmation.

Wallets and signing

- Generate and derive EVM wallets from entropy.
- Sign messages and transactions.

Utilities

- Format and parse amounts for display.
- Normalize addresses and shorten hashes.
- Transform bigint values for UI use.

ABIs and constants

- ERC-20 ABI for balance and transfer calls.
- Multicall3 ABI and address for batched reads.
- Gas limit defaults per transaction type.

Networks registry

- The SDK includes a predefined networks registry in `src/constants/NETWORKS_REGISTRY.ts`.
- Networks are grouped by `category` (for example: `popular`, `custom`).
- Each network entry includes:
	- `id`: stable internal identifier.
	- `name`: human-readable network name.
	- `chainId`: EVM chain ID.
	- `rpcUrl`: primary RPC endpoint.
	- `failoverRpcUrl` (optional): fallback RPC endpoint.
	- `explorerUrl`: block explorer base URL.
	- `iconUrl`: network icon URL.
	- `symbol`: native currency symbol.
- This registry is useful for network selection UIs, chain metadata lookup, and RPC fallback handling.
- You can use `chainId` with SDK helpers and pass `rpcUrl` (or `failoverRpcUrl`) to provider-based calls.

## Design notes

- The SDK is stateless and transport-agnostic. It expects a caller-provided RPC URL.
- Caching, polling, and background jobs should be handled by the consumer app or backend.