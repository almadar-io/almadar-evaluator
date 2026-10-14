// D-12: a present argument that contradicts the type the operator table declares for its position raises
// the typed TypeMismatch. One fixture, read by this suite and by orbital-core `tests/operator_types.rs`
// (canonical source `@almadar-io/parity` `fixtures/operator-types`, mirrored into each test dir).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EntityRow, RuntimeValue, SExpr } from '@almadar/core';
import { evaluate, EvalTypeMismatchError } from '../index.js';
import { createMinimalContext } from '../context.js';
import { operatorSignature } from '../operator-arg-types.js';

interface TypeMismatchExpectation {
  kind: 'TypeMismatch';
  expected: string;
  actual: string;
}

interface Case {
  name: string;
  expr: SExpr;
  entity?: EntityRow;
  expect: { value: RuntimeValue } | { error: TypeMismatchExpectation };
}

interface Fixture {
  cases: Case[];
}

const fixture: Fixture = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/operator-types/operator-types.json'), 'utf-8'),
);

/** Numbers agree within a float epsilon (a trig result may differ in the last digit between the two runtimes). */
function isRecord(v: RuntimeValue): v is Record<string, RuntimeValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function agree(a: RuntimeValue, b: RuntimeValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => agree(x, b[i]));
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => k in b && agree(a[k], b[k]));
  }
  return a === b;
}

describe('operator argument types (shared fixture)', () => {
  it.each(fixture.cases)('$name', (tc) => {
    const ctx = createMinimalContext(tc.entity ?? {});
    if ('error' in tc.expect) {
      const { expected, actual } = tc.expect.error;
      let raised: Error | null = null;
      try {
        evaluate(tc.expr, ctx);
      } catch (err) {
        raised = err instanceof Error ? err : null;
      }
      expect(raised).toBeInstanceOf(EvalTypeMismatchError);
      expect(raised?.message).toBe(`Type mismatch: expected ${expected}, got ${actual}`);
    } else {
      const got = evaluate(tc.expr, ctx);
      expect(agree(got, tc.expect.value), `${JSON.stringify(got)} vs ${JSON.stringify(tc.expect.value)}`).toBe(true);
    }
  });
});

describe('operatorSignature', () => {
  it('reads the declared parameters of an operator whose call checks something', () => {
    expect(operatorSignature('+')?.unbounded).toBe(true);
    expect(operatorSignature('str/upper')?.params.map((p) => p.type)).toEqual(['string']);
    expect(operatorSignature('array/map')?.params.map((p) => p.name)).toEqual(['arr', 'fn']);
  });

  it('declares type variables, not `any`', () => {
    expect(operatorSignature('=')?.params.map((p) => p.type)).toEqual([
      { kind: 'var', name: 'T' },
      { kind: 'var', name: 'T' },
    ]);
    expect(operatorSignature('<')?.params[0].type).toEqual({
      kind: 'var',
      name: 'T',
      bound: { kind: 'union', of: ['number', 'string'] },
    });
  });

  it('control: effects and unknown operators have no signature', () => {
    expect(operatorSignature('emit')).toBeUndefined();
    expect(operatorSignature('not-an-operator')).toBeUndefined();
  });
});
