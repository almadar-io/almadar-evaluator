<!-- Gap ledger for this repo: the source of truth for its open gaps. Managed with scripts/gaps-ledger.mjs in the Almadar monorepo. -->
# @almadar/evaluator — open gaps

Every open gap this repo owns lives here. This file is the source of truth; the monorepo's `docs/Almadar_Gaps.md` only rolls it up.

- **One entry per gap:** `- **<code>** — <what is wrong and where>. <owning package> [mechanical|architectural] — <evidence, prevention rung>`. `[mechanical]` = small and well-scoped; `[architectural]` = needs design judgment.
- **Codes:** new gaps use this repo's prefix `G-EVALUATOR-`. Take the "Next code" below, then bump it in the same edit. Codes are never reused or renamed.
- **Close by deleting.** Remove the entry in the same commit as the fix. There is no "closed" section; git history is the record.
- **Cross-repo gaps don't go here.** If fixing it needs another repo, describe it in your report or PR body; the monorepo coordinator files it.

Next code: `G-EVALUATOR-002`

## Open gaps

- **G-EVALUATOR-001** — `compile()` treats a `let` binding pair as an operator call when the binding's NAME is also an operator: io `std-algo-bubblesort.orb` binds `[swap (> @aVal @bVal)]`, and the compiled path runs std `assertOperatorArity('swap', 1)` on the pair and throws `(swap …): expected 2 argument(s), got 1`, while the interpreter correctly binds the name (reproduced 2026-09-28; the `compile-parity` registry sweep reds on it). Compile a `let`'s binding list as name/value pairs, never as calls, with a unit test binding every operator-named identifier. `SExpressionEvaluator` compile path · [mechanical]
