/**
 * Operator Coverage Safety Net
 *
 * Enumerates every operator declared in `@almadar/std`'s registry and
 * asserts each one either (a) has a dispatch `case` in
 * `SExpressionEvaluator.ts::dispatchOperator`, or (b) is explicitly
 * allowlisted below with a stated reason. Before this test, an operator
 * could be declared (and pass `orb validate`) with zero runtime-path
 * implementation, silently unrunnable under `@almadar/runtime` — exactly
 * the class of gap `Almadar_Runtime_Gaps.md`'s `R-ML-CIRCUIT-OPERATORS-MISSING`
 * entry described. This test is the regression guard against that
 * recurring for any future operator, ML or otherwise.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { getAllStdOperators, getStdOperatorMeta } from '@almadar/std/registry';

const here = path.dirname(fileURLToPath(import.meta.url));
const evaluatorSource = readFileSync(path.join(here, '../SExpressionEvaluator.ts'), 'utf-8');

/** Every operator name that appears as a `case '<name>':` label in dispatchOperator's switch. */
function dispatchedOperatorNames(): Set<string> {
  const names = new Set<string>();
  const caseRe = /case\s+'([^']+)'\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = caseRe.exec(evaluatorSource)) !== null) {
    names.add(match[1]);
  }
  return names;
}

const DISPATCHED = dispatchedOperatorNames();

/**
 * Raw ML kernel operators — Python compile target only, by design (POC plan
 * `Almadar_Intelligence_Ladder_POC_PLAN.md` doctrine 4.4: "std ML atoms
 * express inference as a service call; raw kernel operators are
 * Python-target only"). `tensor/*` is category `ml-tensor`; `nn/*` (+ the
 * bare `forward` alias) is `ml-arch`/`ml-effect`; `train/*` + `checkpoint/*`
 * (+ the bare `train`/`evaluate` aliases) are `ml-effect`. An atom that
 * inlines one of these validates and is then unrunnable on the JS runtime
 * path by design — `call-service "ml" "infer"` is the only sanctioned
 * crossing. Derived from `category`, not a hand-maintained name list, so it
 * tracks the registry automatically as tensor/nn/train/checkpoint grow.
 */
const PYTHON_ONLY_CATEGORIES: ReadonlySet<string> = new Set(['ml-tensor', 'ml-arch', 'ml-effect']);

export const PYTHON_ONLY: readonly string[] = getAllStdOperators().filter((name) => {
  const meta = getStdOperatorMeta(name);
  return meta !== undefined && PYTHON_ONLY_CATEGORIES.has(meta.category);
});

/**
 * Pre-existing gaps discovered by this test, unrelated to the ML
 * circuit-operators work this test was built for (contract/graph/data are
 * all implemented — see contract.test.ts / graph.test.ts / data.test.ts).
 * NOT Python-only by doctrine — these are genuinely missing on the JS path
 * with no allowlist rationale beyond "out of scope for this task." Recorded
 * in `docs/Almadar_Runtime_Gaps.md` (R-EVALUATOR-MISSING-CORE-EFFECT-DISPATCH).
 * Remove an entry here the moment its dispatch case + implementation lands.
 */
export const KNOWN_GAPS: readonly string[] = [
  // core.ts effects
  'fetch-stream',
  'send-server',
  'log',
  'fetch',
  // browser.ts
  'browser/open-file-picker',
  'browser/clipboard-read',
  'browser/clipboard-write',
  'browser/geolocation-current',
  // composition.ts
  'behavior/compose',
  'behavior/wire',
  'behavior/detect-layout',
  'behavior/pipe',
  // behavior.ts
  'compose/compose-all',
  'compose/compose-children',
  'behavior/instantiate',
  'behavior/call',
  'lolo/emit-body',
  'validate/validate',
];

describe('operator coverage: every std operator is dispatched or explicitly allowlisted', () => {
  it('has no operator with neither a dispatch case nor an allowlist entry', () => {
    const allowlisted = new Set([...PYTHON_ONLY, ...KNOWN_GAPS]);
    const missing = getAllStdOperators().filter(
      (name) => !DISPATCHED.has(name) && !allowlisted.has(name)
    );
    expect(missing).toEqual([]);
  });

  it('every contract/*, graph/*, data/* operator (this task) is actually dispatched', () => {
    const mlCircuitOps = getAllStdOperators().filter((name) => {
      const meta = getStdOperatorMeta(name);
      return meta !== undefined && ['ml-contract', 'ml-graph', 'ml-data'].includes(meta.category);
    });
    // Sanity: this task implements all 6 + 14 + 7 = 27 circuit-side ML operators.
    expect(mlCircuitOps.length).toBe(27);
    for (const op of mlCircuitOps) {
      expect(DISPATCHED.has(op)).toBe(true);
    }
  });

  it('KNOWN_GAPS entries are not accidentally allowlisted while already dispatched', () => {
    for (const op of KNOWN_GAPS) {
      expect(DISPATCHED.has(op)).toBe(false);
    }
  });
});
