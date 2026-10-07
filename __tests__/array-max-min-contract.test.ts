// The one `array/max` / `array/min` contract shared with orbital-core's ArrayMaxOp /
// ArrayMinOp (G-CROSS-082): elements read like `Value::to_number` (numbers, booleans,
// null, numeric strings; anything else skipped), an optional field form reading
// `item[key]` (an absent field is skipped), and `null` when nothing counts.
import { describe, it, expect } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate } from '../index.js';
import { createMinimalContext } from '../context.js';

const run = (expr: SExpr) => evaluate(expr, createMinimalContext({}, {}, 'idle'));

describe('array/max and array/min', () => {
  it('read elements through to_number and skip the rest', () => {
    expect(run(['array/max', [3, '7', true, 'x']])).toBe(7);
    expect(run(['array/min', [3, '7', false, 'x']])).toBe(0);
  });

  it('are null when nothing counts', () => {
    expect(run(['array/max', []])).toBeNull();
    expect(run(['array/min', ['x']])).toBeNull();
  });

  it('read a field when given one, skipping an absent field', () => {
    expect(run(['array/max', [{ price: 3 }, { price: '9' }, { name: 'n' }], 'price'])).toBe(9);
    expect(run(['array/min', [{ price: 3 }, { price: 9 }], 'price'])).toBe(3);
    expect(run(['array/max', [{ name: 'n' }], 'price'])).toBeNull();
  });
});
