<!-- Gap ledger for this repo: the source of truth for its open gaps. Managed with scripts/gaps-ledger.mjs in the Almadar monorepo. -->
# @almadar/evaluator — open gaps

Every open gap this repo owns lives here. This file is the source of truth; the monorepo's `docs/Almadar_Gaps.md` only rolls it up.

Next code: `G-EVALUATOR-004`

## Open gaps

- **G-EVALUATOR-003** — `array/sum` has two runtime implementations that disagree with each other and with orbital-core: `std/array.ts` `evalArraySum` adds only `typeof value === 'number'` elements, `operators/collections.ts` `evalSum` (the `sum` alias of the same operator) uses `toNumber`, and orbital-core's `ArraySumOp` plus the compiled TS (`Number(v) || 0`, 2026-10-12) count numeric strings, booleans and null-as-0. `(array/sum ["2" true])` is 0 on the runtime path and 3 compiled. Converge both runtime entries on one `to_number`-equivalent and add an operator conformance row. Prevention rung: the shared operator conformance fixtures (both evaluators + compiled). [mechanical]

- **G-EVALUATOR-001** — `compile()` treats a `let` binding pair as an operator call when the binding's NAME is also an operator: io `std-algo-bubblesort.orb` binds `[swap (> @aVal @bVal)]`, and the compiled path runs std `assertOperatorArity('swap', 1)` on the pair and throws `(swap …): expected 2 argument(s), got 1`, while the interpreter correctly binds the name (reproduced 2026-09-28; the `compile-parity` registry sweep reds on it). Compile a `let`'s binding list as name/value pairs, never as calls, with a unit test binding every operator-named identifier. `SExpressionEvaluator` compile path · [mechanical]
