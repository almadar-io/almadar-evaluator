/**
 * Arity guard for the S-expression interpreter — parity with the compiled
 * path's `resolve_sexpr_call` bounds check (C-EMIT-MAX-ARITY-SILENT-DROP /
 * R-EVALUATOR-NO-ARITY-CHECK). Both paths consult the SAME canonical
 * registry (`@almadar/std/canonical-operators.json`, baked into the compiler
 * as `baked/canonical-operators.json`), so a schema that over-applies a
 * fixed-arity operator fails identically everywhere instead of running
 * silently on the interpreter while `orb validate` rejects it.
 *
 * `maxArity: null` marks a variadic operator (any count ≥ minArity).
 * Operators absent from the registry impose no bounds — the evaluator's
 * data-array fallback handles unregistered heads.
 */
// The registry JSON is INLINED into the evaluator dist at build time (tsup
// bundles the import — no runtime resolution). Runtime alternatives both
// break a consumer class: a live ESM JSON import needs `with {type:'json'}`
// attributes plain node dists don't carry (playground server crash), and
// `createRequire('node:module')` doesn't exist in browser bundles (Vite
// shell-client build failure). Inlining works everywhere.
import canonicalOperators from '@almadar/std/canonical-operators.json';

interface CanonicalOperatorMeta {
  minArity?: number;
  maxArity?: number | null;
}

interface CanonicalOperatorsFile {
  operators: Record<string, CanonicalOperatorMeta>;
}

const ARITY: ReadonlyMap<string, { min: number; max: number | null }> = new Map(
  Object.entries((canonicalOperators as CanonicalOperatorsFile).operators).map(
    ([name, meta]) => [
      name,
      { min: meta.minArity ?? 0, max: meta.maxArity === undefined ? null : meta.maxArity },
    ],
  ),
);

/**
 * Throw when `op` is a registered operator applied with an argument count
 * outside its canonical bounds. No-op for unregistered heads.
 */
export function assertOperatorArity(op: string, argCount: number): void {
  const bounds = ARITY.get(op);
  if (!bounds) return;
  const { min, max } = bounds;
  if (argCount < min || (max !== null && argCount > max)) {
    const range = max === null ? `at least ${min}` : min === max ? `${min}` : `${min}..${max}`;
    throw new Error(
      `(${op} …): expected ${range} argument(s), got ${argCount} — same bounds the compiled path enforces (canonical-operators.json)`,
    );
  }
}
