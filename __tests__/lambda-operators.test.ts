// Every lambda-taking operator applies its `(fn …)` per element, never treating the closure as a truthy value. Twin of orbital-core `tests/lambda_operators.rs` (identical table).
import { describe, it, expect } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate } from '../index.js';
import { createMinimalContext } from '../context.js';

const gt = (n: number): SExpr => ['fn', 'x', ['>', '@x', n]];

const CASES: Array<[string, SExpr, unknown]> = [
  ['array/count', ['array/count', ['list', 1, 2, 3], gt(1)], 2],
  ['array/every true', ['array/every', ['list', 2, 3], gt(1)], true],
  ['array/every false', ['array/every', ['list', 1, 2], gt(5)], false],
  ['array/filter', ['array/filter', ['list', 1, 2, 3], gt(1)], [2, 3]],
  ['array/find', ['array/find', ['list', 1, 2, 3], gt(1)], 2],
  ['array/findIndex', ['array/findIndex', ['list', 1, 2, 3], gt(1)], 1],
  ['array/map', ['array/map', ['list', 1, 2], ['fn', 'x', ['*', '@x', 2]]], [2, 4]],
  ['array/partition', ['array/partition', ['list', 1, 2, 3], gt(1)], [[2, 3], [1]]],
  ['array/reduce', ['array/reduce', ['list', 1, 2, 3], 0, ['fn', ['acc', 'x'], ['+', '@acc', '@x']]], 6],
  ['array/reject', ['array/reject', ['list', 1, 2, 3], gt(1)], [1]],
  ['array/some true', ['array/some', ['list', 1, 9], gt(5)], true],
  ['array/some false', ['array/some', ['list', 1, 2], gt(5)], false],
  ['object/filter', ['object/filter', { a: 1, b: 2 }, ['fn', ['k', 'v'], ['>', '@v', 1]]], { b: 2 }],
  ['object/mapKeys', ['object/mapKeys', { a: 1 }, ['fn', 'k', ['str/upper', '@k']]], { A: 1 }],
  ['object/mapValues', ['object/mapValues', { a: 1, b: 2 }, ['fn', 'v', ['*', '@v', 10]]], { a: 10, b: 20 }],
];

describe('lambda operators apply their fn', () => {
  it.each(CASES)('%s', (_name, expr, expected) => {
    expect(evaluate(expr, createMinimalContext())).toEqual(expected);
  });
});
