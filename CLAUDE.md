## Conventions for this SDK

- Package manager is yarn, not npm.
- Monetary amounts are always `bigint`, never `number`, at any
  boundary — see 001's SDK-1/SDK-2.
- Every thrown domain error extends its own spec's error class —
  never a plain `Error` for an anticipated failure — with a code
  from that spec's closed set. Each spec owns both:
  `SwapError`/`SwapErrorCode` (001, `swap/SwapError.ts`),
  `ExternalSignerError`/`ExternalSignerErrorCode`
  (004, `signing/ExternalSignerError.ts`).
- Those error classes are siblings, never subclasses of one
  another, so each narrows independently: `isSwapError` stays
  false for an `ExternalSignerError`, and vice versa. A new spec
  with its own failures adds a class and a type guard — it does
  not extend an existing one.
- Run `yarn prettier` and `yarn build` before considering any task done.
- Do NOT add explanatory comments to code (no "// this validates X",
  no JSDoc-style descriptions of what a function does).
- Code should be self-explanatory through naming. If it needs a
  comment to be understood, prefer restructuring it instead.
- EXCEPTION: clause-traceability comments citing spec IDs are
  required (e.g. `// Satisfies SDK-1, SDK-2, FC-6`). These are not
  explanatory comments — they're contract references.