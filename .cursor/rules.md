# Project: onchain-sdk

Language: TypeScript

Runtime: Node.js 20+

Package Manager: yarn

Project Type: Published npm SDK for EVM-compatible blockchains.

## Architecture Rules

* Follow existing patterns already present in the repository.
* Prefer object-oriented design for SDK clients and stateful services.
* Prefer pure functions for stateless utilities.
* Reuse existing abstractions before introducing new ones.
* Do not add runtime dependencies unless explicitly requested.
* Keep bundle size small.

## API Compatibility

* This package is consumed by external applications.
* Maintain backwards compatibility whenever possible.
* Public exports from src/index.ts are considered part of the public API.
* Do not remove or modify exported types without explicit approval.
* Prefer additive changes over breaking changes.

## Blockchain Rules

* Never invent blockchain addresses, token metadata, chain IDs, RPC URLs, or contract information.
* If required blockchain data is missing from the repository, ask for a source or confirmation.
* Do not assume a token exists on all supported chains.
* Verify chain-specific support before modifying token registries.
* Treat registries as data sources, not business logic.

## Code Quality

* Prefer readonly types when appropriate.
* Keep changes minimal and focused.
* Avoid unnecessary abstractions.
* Preserve existing naming conventions.
* Do not refactor unrelated code.
