import { describe, it, expect } from 'vitest';
import { applyListenPayloadMapping } from '@almadar/core';
import { evaluateListenPayloadExpr } from '../listen-payload.js';

/**
 * End-to-end pin for the `with { ... }` contract: core's mapping helper driven
 * by the REAL evaluator. `@almadar/core`'s own suite can only exercise the
 * helper against a stand-in (it sits upstream of this package), so this is the
 * test that proves the semantics the compiled path must match — see
 * `orbital-core/src/runtime/listener.rs:126-136`.
 */
describe('applyListenPayloadMapping + evaluateListenPayloadExpr', () => {
  it('renames a field (the historical @payload.<field> form)', () => {
    expect(
      applyListenPayloadMapping({ searchTerm: '@payload.value' }, { value: 'algebra' }, evaluateListenPayloadExpr),
    ).toEqual({ searchTerm: 'algebra' });
  });

  it('delivers a bare string as a literal', () => {
    expect(
      applyListenPayloadMapping({ status: 'mastered' }, { mean: 0.9 }, evaluateListenPayloadExpr),
    ).toEqual({ status: 'mastered' });
  });

  it('projects a field out of a carried request object', () => {
    expect(
      applyListenPayloadMapping(
        {
          candidate: '@payload.candidate',
          accepted: ['object/get', '@payload.request', 'accepted'],
          request: '@payload.request',
        },
        { candidate: 'mitosis', request: { accepted: ['mitosis', 'meiosis'] } },
        evaluateListenPayloadExpr,
      ),
    ).toEqual({
      candidate: 'mitosis',
      accepted: ['mitosis', 'meiosis'],
      request: { accepted: ['mitosis', 'meiosis'] },
    });
  });

  it('coerces a candidate to a string query via str/concat', () => {
    expect(
      applyListenPayloadMapping(
        { query: ['str/concat', '@payload.candidate'] },
        { candidate: 42 },
        evaluateListenPayloadExpr,
      ),
    ).toEqual({ query: '42' });
  });

  it('evaluates an object literal with a payload read inside', () => {
    expect(
      applyListenPayloadMapping(
        { verdict: { status: 'mastered', mean: '@payload.mean' } },
        { mean: 0.91 },
        evaluateListenPayloadExpr,
      ),
    ).toEqual({ verdict: { status: 'mastered', mean: 0.91 } });
  });

  it('binds the payload only — @entity and @config never resolve here', () => {
    // Parity guard: the Rust listener builds a payload-only context. If this
    // ever started resolving, a mapping would work on the JS path and silently
    // yield nothing on the compiled one.
    expect(
      applyListenPayloadMapping(
        { fromEntity: '@entity.name', fromConfig: '@config.pageSize', fromPayload: '@payload.ok' },
        { ok: 'yes' },
        evaluateListenPayloadExpr,
      ),
    ).toEqual({ fromEntity: undefined, fromConfig: undefined, fromPayload: 'yes' });
  });
});
