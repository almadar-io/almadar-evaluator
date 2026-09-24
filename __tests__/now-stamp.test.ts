// Every time operator reads the dispatch's one `now` stamp (ctx.now), never the wall clock.
import { describe, it, expect, vi } from 'vitest';
import { evaluate } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';

const STAMP = Date.UTC(2020, 5, 15, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function ctxAt(now: number) {
  const ctx = createMinimalContext();
  ctx.now = now;
  return ctx;
}

describe('the dispatch now stamp', () => {
  it('`@now` and `(time/now)` both return the stamp, not the wall clock', () => {
    const ctx = ctxAt(STAMP);
    expect(evaluate('@now', ctx)).toBe(STAMP);
    expect(evaluate(['time/now'], ctx)).toBe(STAMP);
  });

  it('repeated reads within one context are identical even as the wall clock moves', () => {
    const ctx = ctxAt(STAMP);
    const first = evaluate(['time/now'], ctx);
    const spy = vi.spyOn(Date, 'now').mockReturnValue(STAMP + DAY);
    try {
      expect(evaluate(['time/now'], ctx)).toBe(first);
      expect(evaluate('@now', ctx)).toBe(first);
    } finally {
      spy.mockRestore();
    }
  });

  it('isPast / isFuture compare against the stamp', () => {
    const ctx = ctxAt(STAMP);
    const between = STAMP + DAY;
    expect(evaluate(['time/isFuture', between], ctx)).toBe(true);
    expect(evaluate(['time/isPast', between], ctx)).toBe(false);
    expect(evaluate(['time/isPast', STAMP - 1], ctx)).toBe(true);
    expect(evaluate(['time/isFuture', STAMP], ctx)).toBe(false);
    expect(evaluate(['time/isPast', STAMP], ctx)).toBe(false);
  });

  it('isToday and today are relative to the stamp\'s own day', () => {
    const ctx = ctxAt(STAMP);
    expect(evaluate(['time/isToday', STAMP + 60_000], ctx)).toBe(true);
    expect(evaluate(['time/isToday', STAMP + 2 * DAY], ctx)).toBe(false);
    const midnight = new Date(STAMP);
    midnight.setHours(0, 0, 0, 0);
    expect(evaluate(['time/today'], ctx)).toBe(midnight.getTime());
  });

  it('relative formatting measures from the stamp', () => {
    const ctx = ctxAt(STAMP);
    expect(evaluate(['time/relative', STAMP], ctx)).toBe('just now');
    expect(evaluate(['time/relative', STAMP - 3 * DAY], ctx)).toMatch(/3 days ago/);
  });

  it('two contexts with different stamps disagree', () => {
    expect(evaluate(['time/now'], ctxAt(STAMP))).not.toBe(evaluate(['time/now'], ctxAt(STAMP + 1)));
  });
});
