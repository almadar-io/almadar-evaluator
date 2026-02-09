/**
 * Golden File Parity Tests
 *
 * These tests validate the TypeScript evaluator against shared golden files
 * that are also used by the Rust evaluator (orbital-core).
 * A mismatch means a cross-language parity bug.
 */

import { describe, it, expect } from 'vitest';
import { evaluate, evaluateGuard } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadGolden(name: string) {
    // __tests__/ → almadar-evaluator/ → packages/ → almadar-test-schemas/
    const paths = [
        resolve(__dirname, '../../almadar-test-schemas/expected/evaluator', name),
    ];
    for (const p of paths) {
        try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { }
    }
    throw new Error(`Golden file not found: ${name} (tried: ${paths.join(', ')})`);
}

// ============================================================================
// Expression Golden File Tests
// ============================================================================

describe('Golden File: Expressions', () => {
    const golden = loadGolden('expressions.golden.json');
    const ctx = createMinimalContext({}, {}, 'idle');

    for (const [category, cases] of Object.entries(golden.cases)) {
        describe(category, () => {
            for (const tc of cases as any[]) {
                it(`${JSON.stringify(tc.input)} → ${JSON.stringify(tc.expected)}`, () => {
                    const result = evaluate(tc.input, ctx);
                    expect(result).toEqual(tc.expected);
                });
            }
        });
    }
});

// ============================================================================
// Guard Golden File Tests
// ============================================================================

describe('Golden File: Guards', () => {
    const golden = loadGolden('guards.golden.json');

    for (const tc of golden.cases) {
        it(tc.description, () => {
            const ctx = createMinimalContext(tc.entity, {}, 'idle');
            const result = evaluateGuard(tc.expression, ctx);
            expect(result).toBe(tc.expected);
        });
    }
});
