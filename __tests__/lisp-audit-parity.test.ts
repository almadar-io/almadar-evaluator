/**
 * LOLO Lisp audit — runtime/evaluator value-level parity (Phase 0.C of
 * Almadar_Compiler_Runtime_Gaps_PLAN.md).
 *
 * The value-level twin of the schema-level runtime smoke (Phase 0.B) and the
 * Rust parse/lower/format regression (Phase 0.A). These cases were lifted from
 * `tools/lolo-lisp-audit/cross-path-harness.mjs` (now retired) and exercise the
 * pure S-expression surface through `@almadar/evaluator`: arithmetic nesting,
 * namespaced ops (`math/*`, `geo/*`, `vec/*`, `str/*`, `array/*`), control flow,
 * and the `and`/`or` divergence probes.
 *
 * Self-contained in-package: does **not** touch the deprecated
 * `almadar-test-schemas` goldens. The `and`/`or` cases use **operand
 * semantics** (Phase 5, R-OR-AND-RETURN-BOOLEAN) — `and`/`or` return the
 * operand value (JS `&&`/`||`), matching the compiled TS path.
 */

import { describe, it, expect } from 'vitest';
import { evaluate } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { SExpr } from '../index.js';

interface ParityCase {
    label: string;
    expr: SExpr;
    expected: number | string | boolean;
    /** Numeric float result → compare with `toBeCloseTo` instead of `toEqual`. */
    float?: boolean;
}

const cases: ParityCase[] = [
    {
        label: 'arith (+ (* 3 4) (- 10 6))',
        expr: ['+', ['*', 3, 4], ['-', 10, 6]],
        expected: 16,
    },
    { label: 'str/concat', expr: ['str/concat', 'a', 'b', 'c'], expected: 'abc' },
    { label: 'math/max', expr: ['math/max', 3, 7], expected: 7 },
    { label: 'math/floor', expr: ['math/floor', 3.9], expected: 3 },
    { label: 'math/clamp', expr: ['math/clamp', 15, 0, 10], expected: 10 },
    {
        label: 'array/sum(array/map sq)',
        expr: [
            'array/sum',
            ['array/map', [1, 2, 3, 6, 8], ['fn', 'x', ['*', '@x', '@x']]],
        ],
        expected: 1 + 4 + 9 + 36 + 64,
    },
    { label: 'not', expr: ['not', true], expected: false },
    {
        label: 'if (truthy branch)',
        expr: ['if', ['>', 5, 3], 'yes', 'no'],
        expected: 'yes',
    },
    {
        label: 'geo/aabb-overlap (overlap)',
        expr: ['geo/aabb-overlap', { x: 0, y: 0, w: 5, h: 5 }, { x: 3, y: 3, w: 5, h: 5 }],
        expected: true,
    },
    {
        label: 'geo/aabb-overlap (no overlap)',
        expr: ['geo/aabb-overlap', { x: 0, y: 0, w: 2, h: 2 }, { x: 10, y: 10, w: 2, h: 2 }],
        expected: false,
    },
    {
        label: 'vec/distance (3-4-5)',
        expr: ['vec/distance', { x: 0, y: 0 }, { x: 3, y: 4 }],
        expected: 5,
    },
    { label: 'math/cos(0)', expr: ['math/cos', 0], expected: 1, float: true },
    { label: 'math/sin(0)', expr: ['math/sin', 0], expected: 0, float: true },

    // --- and/or probes: operand semantics (Phase 5, R-OR-AND-RETURN-BOOLEAN). ---
    // `and`/`or` now return the operand value (JS `&&`/`||`), matching the
    // compiled TS path — aligned here from the prior boolean-coercion runtime.
    {
        label: 'and true false → false',
        expr: ['and', true, false],
        expected: false,
    },
    {
        label: 'or false 42 → 42 (operand semantics)',
        expr: ['or', false, 42],
        expected: 42,
    },
    {
        label: 'and true "x" → "x" (last truthy operand)',
        expr: ['and', true, 'x'],
        expected: 'x',
    },
    {
        label: 'or 0 null 7 → 7 (first truthy operand)',
        expr: ['or', 0, null, 7],
        expected: 7,
    },
];

describe('LOLO Lisp audit — evaluator value-level parity (Phase 0.C)', () => {
    const ctx = createMinimalContext({});

    for (const tc of cases) {
        it(tc.label, () => {
            const result = evaluate(tc.expr, ctx);
            if (tc.float) {
                expect(result).toBeCloseTo(tc.expected as number, 10);
            } else {
                expect(result).toEqual(tc.expected);
            }
        });
    }
});
