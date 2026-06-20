# AGENTS.md

## Project Overview

onchain-sdk is a TypeScript SDK for interacting with EVM-compatible blockchains.

The package exposes blockchain utilities, wallet functionality, transaction helpers, token registries, fee estimation utilities, and stablecoin helpers.

## Stack

* TypeScript
* Node.js 20+
* yarn

## Repository Structure

* `blockchain/`: blockchain interaction helpers
* `services/`: stateful services and wallet-related logic
* `constants/`: registries and static chain/token metadata
* `utils/`: stateless utility functions
* `types/`: shared public types

## Important Guidelines

* Preserve backward compatibility.
* Public exports from `src/index.ts` are considered stable APIs.
* Avoid introducing new dependencies.
* Follow existing repository patterns.
* Prefer extending existing functionality over creating parallel implementations.
* Keep changes scoped to the requested task.

## Blockchain Data

Chain-specific data must be treated carefully.

Never assume:

* token availability across all chains
* contract addresses
* decimals
* symbols
* RPC endpoints

If the information is not present in the repository, request confirmation instead of guessing.

## Decision Making

When multiple solutions are possible:

1. Prefer the least disruptive change.
2. Preserve public APIs.
3. Reuse existing abstractions.
4. Avoid breaking changes.
5. Ask for clarification instead of making unsupported assumptions.
