/**
 * Dashboard Aggregation Tests
 *
 * Locks in the std-stats / std-graphs runtime evaluation paths:
 *   - object literal lambda body where each value is its own SExpression
 *     (the canonical shape for `array/map` returning records).
 *   - chained `if` over a per-row dispatch key (`@metric.aggregation`).
 *   - `array/groupBy → object/entries → array/map` pipeline used by graphs.
 *   - bindings inheriting from the outer ctx through the lambda boundary
 *     (`@payload.data` reachable while `@metric` is locally bound).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate, evaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';

describe('Dashboard aggregations', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    evaluator.clearCache();
    ctx = createMinimalContext(
      {},
      {
        data: [
          { id: 'a', name: 'Item A', status: 'active', category: 'foo', amount: 10, units: 2 },
          { id: 'b', name: 'Item B', status: 'active', category: 'foo', amount: 25, units: 4 },
          { id: 'c', name: 'Item C', status: 'active', category: 'bar', amount: 5,  units: 1 },
          { id: 'd', name: 'Item D', status: 'active', category: 'bar', amount: 7,  units: 3 },
          { id: 'e', name: 'Item E', status: 'active', category: 'baz', amount: 50, units: 5 },
          { id: 'f', name: 'Item F', status: 'inactive', category: 'baz', amount: 0,  units: 0 },
        ],
        totalCount: 6,
      },
    );
  });

  it('std-stats: array/map over @config.metrics with chained-if dispatch', () => {
    // Mirrors std-stats's `(set @entity.cards (array/map @config.metrics
    // ["fn", "metric", { label: ..., value: (if ... ...) }]))` shape.
    const metrics: SExpr = [
      { aggregation: 'count', label: 'Total Items',   icon: 'list',         variant: 'primary',                   format: 'number' },
      { aggregation: 'count', label: 'Active',        icon: 'check-circle', variant: 'success',                   format: 'number' },
      { aggregation: 'sum',   label: 'Total Revenue', icon: 'dollar-sign',  variant: 'info',     field: 'amount', format: 'currency' },
      { aggregation: 'avg',   label: 'Avg Units',     icon: 'trending-up',  variant: 'default',  field: 'units',  format: 'number' },
    ];
    const result = evaluate(
      ['array/map', metrics, ['fn', 'metric', {
        label:   ['object/get', '@metric', 'label'],
        icon:    ['object/get', '@metric', 'icon', ''],
        format:  ['object/get', '@metric', 'format', 'number'],
        variant: ['object/get', '@metric', 'variant', 'default'],
        max:     ['object/get', '@metric', 'max', 0],
        value:   ['if', ['=', ['object/get', '@metric', 'aggregation', 'count'], 'sum'],
                   ['array/sum', '@payload.data', ['object/get', '@metric', 'field', '']],
                   ['if', ['=', ['object/get', '@metric', 'aggregation', 'count'], 'avg'],
                     ['array/avg', '@payload.data', ['object/get', '@metric', 'field', '']],
                     ['array/len', '@payload.data']]],
      }]],
      ctx,
    ) as Array<Record<string, unknown>>;
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ label: 'Total Items',   value: 6, variant: 'primary', format: 'number' });
    expect(result[1]).toMatchObject({ label: 'Active',        value: 6, variant: 'success' });
    expect(result[2]).toMatchObject({ label: 'Total Revenue', value: 97 });
    expect(result[3]).toMatchObject({ label: 'Avg Units',     value: 15 / 6 });
  });

  it('std-stats v2: filterField/filterValue narrows aggregation by single-field equality', () => {
    // Mirrors the new std-stats lambda body — each metric optionally
    // supplies `filterField`+`filterValue`; the filter wraps array/filter
    // with a fn-form predicate that compiles cleanly in both runtime and
    // codegen paths (an SExpression-shaped `filter` would compile to
    // `.filter(arrayValue)` which TypeErrors at runtime in the codegen
    // path). Lets one metrics array yield "Total: 6" alongside
    // "Active: 5" without a separate fetch.
    const metrics: SExpr = [
      { aggregation: 'count', label: 'Total' },                                                            // no filter → all rows
      { aggregation: 'count', label: 'Active',        filterField: 'status', filterValue: 'active' },
      { aggregation: 'sum',   label: 'ActiveRevenue', field: 'amount', filterField: 'status', filterValue: 'active' },
    ];
    const filterPred = ['fn', 'row',
      ['if', ['=', ['object/get', '@metric', 'filterField', ''], ''],
        true,
        ['=',
          ['object/get', '@row', ['object/get', '@metric', 'filterField', '']],
          ['object/get', '@metric', 'filterValue', '']]]];
    const result = evaluate(
      ['array/map', metrics, ['fn', 'metric', {
        label:   ['object/get', '@metric', 'label'],
        value:   ['if', ['=', ['object/get', '@metric', 'aggregation', 'count'], 'sum'],
                   ['array/sum', ['array/filter', '@payload.data', filterPred], ['object/get', '@metric', 'field', '']],
                   ['array/len', ['array/filter', '@payload.data', filterPred]]],
      }]],
      ctx,
    ) as Array<{ label: string; value: number }>;
    expect(result[0]).toEqual({ label: 'Total',         value: 6 });
    expect(result[1]).toEqual({ label: 'Active',        value: 5 });
    expect(result[2]).toEqual({ label: 'ActiveRevenue', value: 10 + 25 + 5 + 7 + 50 });
  });

  it('std-graphs: groupBy → entries → map produces {label, value} chart points', () => {
    // Mirrors std-graphs's `(set @entity.chartData (array/map (object/entries
    // (array/groupBy @payload.data @config.categoryField)) ["fn", "entry", ...]))`.
    // After the inline phase substitutes @config.aggregation = "count" the
    // chained-if collapses to `array/len` over each bucket.
    const result = evaluate(
      ['array/map',
        ['object/entries', ['array/groupBy', '@payload.data', 'status']],
        ['fn', 'entry', {
          label: ['object/get', '@entry', '0'],
          value: ['array/len', ['object/get', '@entry', '1']],
        }],
      ],
      ctx,
    ) as Array<{ label: string; value: number }>;
    const sorted = [...result].sort((a, b) => a.label.localeCompare(b.label));
    expect(sorted).toEqual([
      { label: 'active', value: 5 },
      { label: 'inactive', value: 1 },
    ]);
  });

  it('std-graphs: sum aggregation per group resolves @entry.1 array reference', () => {
    // Same pipeline, but with `sum` aggregation over a numeric field per
    // bucket (e.g. revenue per category). Verifies array/sum receives the
    // per-bucket array via `(object/get @entry "1")` rather than the outer
    // payload, and the `field` argument flows through the inner lambda.
    const result = evaluate(
      ['array/map',
        ['object/entries', ['array/groupBy', '@payload.data', 'category']],
        ['fn', 'entry', {
          label: ['object/get', '@entry', '0'],
          value: ['array/sum', ['object/get', '@entry', '1'], 'amount'],
        }],
      ],
      ctx,
    ) as Array<{ label: string; value: number }>;
    const byLabel = Object.fromEntries(result.map((r) => [r.label, r.value]));
    expect(byLabel).toEqual({ foo: 35, bar: 12, baz: 50 });
  });

  it('lambda body @payload.data binding inherits through createChildContext', () => {
    // Regression guard for the substitution path: a local-bound `@metric`
    // must NOT shadow `@payload` from the parent ctx. If createChildContext
    // ever clobbers parent's payload, the chained-if collapses every metric
    // to length-of-empty-array (0) and stat cards render as "0/0".
    const result = evaluate(
      ['array/map',
        [{ aggregation: 'count', label: 'A' }],
        ['fn', 'metric', {
          label: ['object/get', '@metric', 'label'],
          rowCount: ['array/len', '@payload.data'],
        }],
      ],
      ctx,
    ) as Array<{ label: string; rowCount: number }>;
    expect(result).toEqual([{ label: 'A', rowCount: 6 }]);
  });
});
