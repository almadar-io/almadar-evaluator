<!-- Gap ledger for this repo: the source of truth for its open gaps. Managed with scripts/gaps-ledger.mjs in the Almadar monorepo. -->
# @almadar/evaluator — open gaps

Every open gap this repo owns lives here. This file is the source of truth; the monorepo's `docs/Almadar_Gaps.md` only rolls it up.

## Open gaps

- **G-EVALUATOR-001** — `compile()` treats a `let` binding pair as an operator call when the binding's NAME is also an operator: io `std-algo-bubblesort.orb` binds `[swap (> @aVal @bVal)]`, and the compiled path runs std `assertOperatorArity('swap', 1)` on the pair and throws `(swap …): expected 2 argument(s), got 1`, while the interpreter correctly binds the name (reproduced 2026-09-28; the `compile-parity` registry sweep reds on it). Compile a `let`'s binding list as name/value pairs, never as calls, with a unit test binding every operator-named identifier. `SExpressionEvaluator` compile path · [mechanical]
