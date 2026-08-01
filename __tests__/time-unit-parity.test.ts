/**
 * `time/*` unit semantics, and the parity contract with the Rust kernel.
 *
 * This is the JS half of `orbital-rust/crates/orbital-core/tests/
 * time_unit_parity.rs`. The case table and every expected value are identical
 * on purpose: `S-CALENDAR-RANGE-FILTER-USES-UNSUPPORTED-TIME-UNITS` shipped
 * because the two paths disagreed about what a time unit is and nothing
 * compared them. Five divergences were closed together —
 *
 *   1. `month`/`year` evaluated here and threw in Rust (the reported bug);
 *   2. `d`/`w`/`h`/`s` were accepted in Rust and silently no-opped here;
 *   3. `time/diff` returned a signed value here and `.abs()` in Rust, and
 *      approximated months as 30.44 days here;
 *   4. `time/startOf` began weeks on Sunday here and Monday in Rust;
 *   5. an unknown unit threw in Rust and silently returned the input here.
 *
 * Changing either path without changing the other must fail a test here.
 */

import { describe, it, expect } from 'vitest';
import { evaluate } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { SExpr } from '../types/expression.js';

/** 2024-03-31T12:34:56.789Z — leap year, on the 31st, with a time-of-day. */
const MAR_31_2024 = 1_711_888_496_789;
/** 2024-01-15T00:00:00.000Z — a Monday. */
const JAN_15_2024 = 1_705_276_800_000;
/** 2024-03-01T00:00:00.000Z */
const MAR_1_2024 = 1_709_251_200_000;

const ctx = createMinimalContext();
const ev = (expr: SExpr): unknown => evaluate(expr, ctx);
const num = (expr: SExpr): number => ev(expr) as number;

describe('time unit vocabulary — parity with orbital-core', () => {
  it('evaluates all four branches of the std-calendar range filter', () => {
    for (const [amount, unit] of [
      [1, 'week'],
      [3, 'month'],
      [1, 'year'],
      [1, 'month'],
    ] as const) {
      expect(num(['time/subtract', MAR_31_2024, amount, unit])).toBeLessThan(MAR_31_2024);
    }
  });

  it('does calendar-correct month arithmetic that clamps the day', () => {
    // 31 Mar − 1 month = 29 Feb 2024, NOT 2 Mar via Date.setMonth overflow.
    expect(num(['time/subtract', MAR_31_2024, 1, 'month'])).toBe(1_709_210_096_789);
    expect(num(['time/subtract', MAR_31_2024, 3, 'month'])).toBe(1_704_026_096_789);
    expect(num(['time/subtract', MAR_31_2024, 1, 'year'])).toBe(1_680_266_096_789);
    expect(num(['time/add', MAR_31_2024, 11, 'month'])).toBe(
      num(['time/subtract', MAR_31_2024, -11, 'month'])
    );
  });

  it('clamping is not reversible, and that is correct', () => {
    const back = num(['time/add', ['time/subtract', MAR_31_2024, 1, 'month'], 1, 'month']);
    expect(back).not.toBe(MAR_31_2024);
    expect(back).toBe(1_711_715_696_789); // 2024-03-29T12:34:56.789Z
  });

  it('resolves every accepted spelling, and does not confuse m with month', () => {
    const day = num(['time/subtract', JAN_15_2024, 1, 'day']);
    for (const spelling of ['d', 'days']) {
      expect(num(['time/subtract', JAN_15_2024, 1, spelling])).toBe(day);
    }
    expect(num(['time/subtract', JAN_15_2024, 1, 'm'])).toBe(
      num(['time/subtract', JAN_15_2024, 1, 'minute'])
    );
    expect(num(['time/subtract', JAN_15_2024, 1, 'm'])).not.toBe(
      num(['time/subtract', JAN_15_2024, 1, 'month'])
    );
  });

  it('throws on an unknown unit instead of silently returning the input', () => {
    for (const op of ['time/add', 'time/subtract']) {
      expect(() => ev([op, JAN_15_2024, 1, 'fortnight'])).toThrow(/fortnight/);
    }
    for (const op of ['time/startOf', 'time/endOf']) {
      expect(() => ev([op, JAN_15_2024, 'fortnight'])).toThrow(/fortnight/);
    }
    expect(() => ev(['time/diff', MAR_31_2024, JAN_15_2024, 'fortnight'])).toThrow(/fortnight/);
    expect(() => ev(['time/isSame', MAR_31_2024, JAN_15_2024, 'fortnight'])).toThrow(/fortnight/);
  });

  it('time/diff is signed and counts whole calendar months', () => {
    expect(num(['time/diff', MAR_31_2024, JAN_15_2024, 'day'])).toBe(76);
    expect(num(['time/diff', JAN_15_2024, MAR_31_2024, 'day'])).toBe(-76);
    expect(num(['time/diff', MAR_31_2024, JAN_15_2024, 'month'])).toBe(2);
    expect(num(['time/diff', MAR_31_2024, JAN_15_2024, 'year'])).toBe(0);
    // 31 Jan → 28 Feb is 0 whole months.
    expect(num(['time/diff', 1_709_078_400_000, 1_706_659_200_000, 'month'])).toBe(0);
  });

  it('weeks start on Monday, and endOf is the last ms of the same bucket', () => {
    expect(num(['time/startOf', JAN_15_2024, 'week'])).toBe(JAN_15_2024);
    for (const unit of ['minute', 'hour', 'day', 'week', 'month', 'year']) {
      const start = num(['time/startOf', MAR_31_2024, unit]);
      const end = num(['time/endOf', MAR_31_2024, unit]);
      expect(start).toBeLessThanOrEqual(MAR_31_2024);
      expect(end).toBeGreaterThanOrEqual(MAR_31_2024);
      expect(num(['time/startOf', end, unit])).toBe(start);
    }
  });

  it('time/isSame compares unit buckets, not exact milliseconds', () => {
    expect(ev(['time/isSame', MAR_31_2024, MAR_1_2024, 'month'])).toBe(true);
    expect(ev(['time/isSame', MAR_31_2024, MAR_1_2024, 'year'])).toBe(true);
    expect(ev(['time/isSame', MAR_31_2024, MAR_1_2024, 'day'])).toBe(false);
    expect(ev(['time/isSame', JAN_15_2024, MAR_31_2024, 'year'])).toBe(true);
  });
});
