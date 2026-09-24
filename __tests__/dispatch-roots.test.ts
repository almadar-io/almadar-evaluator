// The dispatch roots resolve from the context; the guards they exist for (once / distinct / re-entry / provenance) evaluate over them.
import { describe, it, expect } from 'vitest';
import type { EventPayload } from '@almadar/core';
import { createMinimalContext, resolveBinding, type EvaluationContext } from '../context.js';
import { evaluateGuard } from '../SExpressionEvaluator.js';

const record = (event: string, payload: EventPayload | null, source: EventPayload): EventPayload => ({ event, payload, source });

function ctx(overrides: Partial<EvaluationContext>): EvaluationContext {
  return { ...createMinimalContext({}, {}, 'searching'), ...overrides };
}

const heartbeatX = record('X', { n: 1 }, { orbital: 'Main', trait: 'Clock', tick: 'heartbeat' });

describe('dispatch roots', () => {
  it('@event and its paths read the delivery record', () => {
    const c = ctx({ event: heartbeatX });
    expect(resolveBinding('@event.event', c)).toBe('X');
    expect(resolveBinding('@event.payload.n', c)).toBe(1);
    expect(resolveBinding('@event.source.tick', c)).toBe('heartbeat');
    expect(resolveBinding('@event.source.originClientId', c)).toBeUndefined();
  });

  it('the logs default to empty and the state roots to undefined when no dispatch is running', () => {
    const c = ctx({});
    expect(resolveBinding('@prevEvents', c)).toEqual([]);
    expect(resolveBinding('@prevStates', c)).toEqual([]);
    expect(resolveBinding('@fromState', c)).toBeUndefined();
    expect(resolveBinding('@toState', c)).toBeUndefined();
    expect(resolveBinding('@event', c)).toBeUndefined();
  });

  it('@fromState and @toState read the transition ends', () => {
    const c = ctx({ fromState: 'idle', toState: 'busy' });
    expect(resolveBinding('@fromState', c)).toBe('idle');
    expect(resolveBinding('@toState', c)).toBe('busy');
  });

  const once: EventPayload[] = [];
  const onceGuard = ['not', ['array/includes', ['array/map', '@prevEvents', ['fn', 'e', ['object/get', '@e', 'event']]], 'X']];

  it('"once": the first X passes, a later X is blocked, a different event does not count', () => {
    expect(evaluateGuard(onceGuard, ctx({ prevEvents: once }))).toBe(true);
    expect(evaluateGuard(onceGuard, ctx({ prevEvents: [heartbeatX] }))).toBe(false);
    expect(evaluateGuard(onceGuard, ctx({ prevEvents: [record('Y', null, {})] }))).toBe(true);
  });

  it('re-entry: blocked only when the trait already left that state this dispatch', () => {
    const reentry = ['not', ['array/includes', '@prevStates', 'processing']];
    expect(evaluateGuard(reentry, ctx({ prevStates: ['idle'] }))).toBe(true);
    expect(evaluateGuard(reentry, ctx({ prevStates: ['idle', 'processing'] }))).toBe(false);
  });

  it('provenance: a guard can accept only tick-driven deliveries', () => {
    const tickOnly = ['=', '@event.source.tick', 'heartbeat'];
    expect(evaluateGuard(tickOnly, ctx({ event: heartbeatX }))).toBe(true);
    expect(evaluateGuard(tickOnly, ctx({ event: record('X', null, { trait: 'Clock' }) }))).toBe(false);
  });
});
