## Conventions for this SDK

- Package manager is yarn, not npm.
- Monetary amounts are always `bigint`, never `number`, at any
  boundary — see spec.md SDK-1/SDK-2.
- Every thrown domain error extends `SwapError` with a code from
  the closed set in spec.md — never throw a plain `Error` for an
  anticipated failure.
- Run `yarn prettier` and `yarn build` before considering any task done.
- Do NOT add explanatory comments to code (no "// this validates X",
  no JSDoc-style descriptions of what a function does).
- Code should be self-explanatory through naming. If it needs a
  comment to be understood, prefer restructuring it instead.
- EXCEPTION: clause-traceability comments citing spec IDs are
  required (e.g. `// Satisfies SDK-1, SDK-2, FC-6`). These are not
  explanatory comments — they're contract references.