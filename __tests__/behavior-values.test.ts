import { describe, it, expect } from 'vitest';
import { SExpressionEvaluator } from '../SExpressionEvaluator';
import { createMinimalContext } from '../context';
import { quasiquoteExpr } from '@almadar/core';
import type { SExpr } from '@almadar/core';

// Language trio on the interpreted path: `behavior/apply` records overrides on a
// trait value; `(quasiquote x)` splices live hole values into a template. Twins
// of orbital-core `tests/behavior_value.rs` and `tests/quasiquote.rs`.
const widget = { behavior: 'almadar-std/std-kanban', trait: 'KanbanBoard' };
const ctx = () => createMinimalContext({ widget, n: 41 }, { knobs: { compact: true } });

describe('behavior/apply', () => {
  it('records overrides on the value held in the entity', () => {
    const ev = new SExpressionEvaluator();
    const out = ev.evaluate(['behavior/apply', '@entity.widget', { config: '@payload.knobs' }], ctx());
    expect(out).toEqual({ ...widget, config: { compact: true } });
  });

  it('merges a second application key-wise', () => {
    const ev = new SExpressionEvaluator();
    const once: SExpr = ['behavior/apply', '@entity.widget', { config: { compact: true, title: 'A' } }];
    const twice: SExpr = ['behavior/apply', once, { config: { title: 'B' } }];
    expect(ev.evaluate(twice, ctx())).toEqual({ ...widget, config: { compact: true, title: 'B' } });
  });

  it('control: an empty override returns the same value', () => {
    expect(new SExpressionEvaluator().evaluate(['behavior/apply', '@entity.widget', {}], ctx())).toEqual(widget);
  });

  it('rejects a value that is not a behavior value, and an override outside the §8 surface', () => {
    const ev = new SExpressionEvaluator();
    expect(() => ev.evaluate(['behavior/apply', '@entity.n', {}], ctx())).toThrow(/behavior value/);
    expect(() => ev.evaluate(['behavior/apply', '@entity.widget', { effects: {} }], ctx())).toThrow(/overrides do not fit/);
  });

  it('records the §8b import body on an orbital value', () => {
    const ev = new SExpressionEvaluator();
    const out = ev.evaluate(['behavior/apply', { behavior: 'almadar-std/std-kanban', orbital: 'KanbanOrbital' }, { entity: 'Task' }], ctx());
    expect(out).toEqual({ behavior: 'almadar-std/std-kanban', orbital: 'KanbanOrbital', entity: 'Task' });
  });

  it('control: a §8 trait key that is not an import key is refused on an orbital value', () => {
    const ev = new SExpressionEvaluator();
    expect(() => ev.evaluate(['behavior/apply', { behavior: 'almadar-std/std-kanban', orbital: 'KanbanOrbital' }, { linkedEntity: 'Task' }], ctx())).toThrow(/overrides do not fit/);
  });
});

describe('quasiquote', () => {
  it('splices the evaluated holes into the template', () => {
    const ev = new SExpressionEvaluator();
    const ir = quasiquoteExpr(['set', '@entity.a', ['unquote', ['+', '@entity.n', 1]]]);
    expect(ev.evaluate(ir, ctx())).toEqual(['set', '@entity.a', 42]);
  });

  it('splices a structured value as data', () => {
    const ev = new SExpressionEvaluator();
    const ir = quasiquoteExpr(['orbital', 'Page', { pages: { '/dash': ['unquote', '@entity.widget'] } }]);
    expect(ev.evaluate(ir, ctx())).toEqual(['orbital', 'Page', { pages: { '/dash': widget } }]);
  });

  it('stays correct once the tree tiers up to compiled closures', () => {
    const ev = new SExpressionEvaluator();
    const ir = quasiquoteExpr(['x', ['unquote', '@entity.n']]);
    for (let i = 0; i < 4; i++) expect(ev.evaluate(ir, ctx())).toEqual(['x', 41]);
  });

  it('control: a template with no hole is returned as written, bindings unresolved', () => {
    const ev = new SExpressionEvaluator();
    expect(ev.evaluate(quasiquoteExpr(['>', '@payload.amount', 0]), ctx())).toEqual(['>', '@payload.amount', 0]);
  });

  it('rejects a hole whose value cannot be held as program data', () => {
    const ev = new SExpressionEvaluator();
    const ir = quasiquoteExpr(['x', ['unquote', ['fn', 'a', '@a']]]);
    expect(() => ev.evaluate(ir, ctx())).toThrow(/program data/);
  });
});
