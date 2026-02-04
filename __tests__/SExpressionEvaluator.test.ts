/**
 * S-Expression Evaluator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SExpressionEvaluator,
  evaluate,
  evaluateGuard,
  executeEffect,
  executeEffects,
} from '../SExpressionEvaluator.js';
import {
  createMinimalContext,
  createEffectContext,
  type EvaluationContext,
} from '../context.js';

describe('SExpressionEvaluator', () => {
  let evaluator: SExpressionEvaluator;
  let ctx: EvaluationContext;

  beforeEach(() => {
    evaluator = new SExpressionEvaluator();
    ctx = createMinimalContext(
      { health: 100, x: 10, y: 20, name: 'Player', items: ['sword', 'shield'] },
      { damage: 25, amount: 50 },
      'idle'
    );
  });

  // ============================================================================
  // Literal Evaluation
  // ============================================================================

  describe('literals', () => {
    it('evaluates numbers', () => {
      expect(evaluate(42, ctx)).toBe(42);
      expect(evaluate(3.14, ctx)).toBe(3.14);
      expect(evaluate(-5, ctx)).toBe(-5);
    });

    it('evaluates strings', () => {
      expect(evaluate('hello', ctx)).toBe('hello');
    });

    it('evaluates booleans', () => {
      expect(evaluate(true, ctx)).toBe(true);
      expect(evaluate(false, ctx)).toBe(false);
    });

    it('evaluates null', () => {
      expect(evaluate(null, ctx)).toBe(null);
    });
  });

  // ============================================================================
  // Binding Resolution
  // ============================================================================

  describe('bindings', () => {
    it('resolves @entity bindings', () => {
      expect(evaluate('@entity.health', ctx)).toBe(100);
      expect(evaluate('@entity.name', ctx)).toBe('Player');
      expect(evaluate('@entity.x', ctx)).toBe(10);
    });

    it('resolves @payload bindings', () => {
      expect(evaluate('@payload.damage', ctx)).toBe(25);
      expect(evaluate('@payload.amount', ctx)).toBe(50);
    });

    it('resolves @state binding', () => {
      expect(evaluate('@state', ctx)).toBe('idle');
    });

    it('resolves @now binding', () => {
      const result = evaluate('@now', ctx) as number;
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('returns undefined for unknown bindings', () => {
      expect(evaluate('@entity.unknown', ctx)).toBeUndefined();
      expect(evaluate('@unknown.field', ctx)).toBeUndefined();
    });

    it('resolves singleton bindings', () => {
      ctx.singletons.set('GameConfig', { gravity: 9.8, maxSpeed: 100 });
      expect(evaluate('@GameConfig.gravity', ctx)).toBe(9.8);
      expect(evaluate('@GameConfig.maxSpeed', ctx)).toBe(100);
    });

    it('resolves @user bindings', () => {
      ctx.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: ['read', 'write', 'delete'],
      };
      expect(evaluate('@user.id', ctx)).toBe('user-123');
      expect(evaluate('@user.email', ctx)).toBe('test@example.com');
      expect(evaluate('@user.name', ctx)).toBe('Test User');
      expect(evaluate('@user.role', ctx)).toBe('admin');
      expect(evaluate('@user.permissions', ctx)).toEqual(['read', 'write', 'delete']);
    });

    it('returns undefined for @user when not set', () => {
      expect(evaluate('@user.id', ctx)).toBeUndefined();
      expect(evaluate('@user.role', ctx)).toBeUndefined();
    });

    it('resolves nested @user fields', () => {
      ctx.user = {
        id: 'user-123',
        profile: {
          avatar: 'avatar.png',
          settings: {
            theme: 'dark',
          },
        },
      };
      expect(evaluate('@user.profile.avatar', ctx)).toBe('avatar.png');
      expect(evaluate('@user.profile.settings.theme', ctx)).toBe('dark');
    });
  });

  // ============================================================================
  // Arithmetic Operators
  // ============================================================================

  describe('arithmetic', () => {
    it('evaluates addition', () => {
      expect(evaluate(['+', 1, 2], ctx)).toBe(3);
      expect(evaluate(['+', 1, 2, 3], ctx)).toBe(6);
      expect(evaluate(['+', '@entity.x', '@entity.y'], ctx)).toBe(30);
    });

    it('evaluates subtraction', () => {
      expect(evaluate(['-', 10, 3], ctx)).toBe(7);
      expect(evaluate(['-', 5], ctx)).toBe(-5); // Negation
      expect(evaluate(['-', '@entity.health', '@payload.damage'], ctx)).toBe(75);
    });

    it('evaluates multiplication', () => {
      expect(evaluate(['*', 3, 4], ctx)).toBe(12);
      expect(evaluate(['*', 2, 3, 4], ctx)).toBe(24);
    });

    it('evaluates division', () => {
      expect(evaluate(['/', 10, 2], ctx)).toBe(5);
      expect(evaluate(['/', 7, 2], ctx)).toBe(3.5);
    });

    it('evaluates modulo', () => {
      expect(evaluate(['%', 10, 3], ctx)).toBe(1);
      expect(evaluate(['%', 15, 5], ctx)).toBe(0);
    });

    it('evaluates abs', () => {
      expect(evaluate(['abs', -5], ctx)).toBe(5);
      expect(evaluate(['abs', 5], ctx)).toBe(5);
    });

    it('evaluates min/max', () => {
      expect(evaluate(['min', 5, 3, 8], ctx)).toBe(3);
      expect(evaluate(['max', 5, 3, 8], ctx)).toBe(8);
    });

    it('evaluates floor/ceil/round', () => {
      expect(evaluate(['floor', 3.7], ctx)).toBe(3);
      expect(evaluate(['ceil', 3.2], ctx)).toBe(4);
      expect(evaluate(['round', 3.5], ctx)).toBe(4);
    });

    it('evaluates clamp', () => {
      expect(evaluate(['clamp', 150, 0, 100], ctx)).toBe(100);
      expect(evaluate(['clamp', -10, 0, 100], ctx)).toBe(0);
      expect(evaluate(['clamp', 50, 0, 100], ctx)).toBe(50);
    });
  });

  // ============================================================================
  // Comparison Operators
  // ============================================================================

  describe('comparison', () => {
    it('evaluates equality', () => {
      expect(evaluate(['=', 5, 5], ctx)).toBe(true);
      expect(evaluate(['=', 5, 3], ctx)).toBe(false);
      expect(evaluate(['=', 'hello', 'hello'], ctx)).toBe(true);
      expect(evaluate(['=', '@entity.health', 100], ctx)).toBe(true);
    });

    it('evaluates not-equal', () => {
      expect(evaluate(['!=', 5, 3], ctx)).toBe(true);
      expect(evaluate(['!=', 5, 5], ctx)).toBe(false);
    });

    it('evaluates less-than', () => {
      expect(evaluate(['<', 3, 5], ctx)).toBe(true);
      expect(evaluate(['<', 5, 3], ctx)).toBe(false);
      expect(evaluate(['<', '@payload.damage', '@entity.health'], ctx)).toBe(true);
    });

    it('evaluates greater-than', () => {
      expect(evaluate(['>', 5, 3], ctx)).toBe(true);
      expect(evaluate(['>', 3, 5], ctx)).toBe(false);
      expect(evaluate(['>', '@entity.health', 0], ctx)).toBe(true);
    });

    it('evaluates less-than-or-equal', () => {
      expect(evaluate(['<=', 3, 5], ctx)).toBe(true);
      expect(evaluate(['<=', 5, 5], ctx)).toBe(true);
      expect(evaluate(['<=', 6, 5], ctx)).toBe(false);
    });

    it('evaluates greater-than-or-equal', () => {
      expect(evaluate(['>=', 5, 3], ctx)).toBe(true);
      expect(evaluate(['>=', 5, 5], ctx)).toBe(true);
      expect(evaluate(['>=', 4, 5], ctx)).toBe(false);
    });
  });

  // ============================================================================
  // Logic Operators
  // ============================================================================

  describe('logic', () => {
    it('evaluates and (short-circuit)', () => {
      expect(evaluate(['and', true, true], ctx)).toBe(true);
      expect(evaluate(['and', true, false], ctx)).toBe(false);
      expect(evaluate(['and', false, true], ctx)).toBe(false);
    });

    it('evaluates or (short-circuit)', () => {
      expect(evaluate(['or', false, true], ctx)).toBe(true);
      expect(evaluate(['or', false, false], ctx)).toBe(false);
      expect(evaluate(['or', true, false], ctx)).toBe(true);
    });

    it('evaluates not', () => {
      expect(evaluate(['not', true], ctx)).toBe(false);
      expect(evaluate(['not', false], ctx)).toBe(true);
    });

    it('evaluates if', () => {
      expect(evaluate(['if', true, 'yes', 'no'], ctx)).toBe('yes');
      expect(evaluate(['if', false, 'yes', 'no'], ctx)).toBe('no');
      expect(evaluate(['if', ['>', '@entity.health', 0], 'alive', 'dead'], ctx)).toBe('alive');
    });
  });

  // ============================================================================
  // Control Operators
  // ============================================================================

  describe('control', () => {
    it('evaluates let bindings', () => {
      const result = evaluate(
        ['let', [['x', 10], ['y', 20]], ['+', '@x', '@y']],
        { ...ctx, locals: new Map() }
      );
      expect(result).toBe(30);
    });

    it('evaluates do blocks', () => {
      let sideEffect = 0;
      const effectCtx = createEffectContext(ctx, {
        mutateEntity: () => { sideEffect++; },
      });
      const result = evaluate(
        ['do', ['set', '@entity.x', 1], ['set', '@entity.y', 2], 'done'],
        effectCtx
      );
      expect(result).toBe('done');
    });

    it('evaluates when (conditional effect)', () => {
      let called = false;
      const effectCtx = createEffectContext(ctx, {
        mutateEntity: () => { called = true; },
      });

      evaluate(['when', true, ['set', '@entity.x', 1]], effectCtx);
      expect(called).toBe(true);

      called = false;
      evaluate(['when', false, ['set', '@entity.x', 1]], effectCtx);
      expect(called).toBe(false);
    });
  });

  // ============================================================================
  // Collection Operators
  // ============================================================================

  describe('collections', () => {
    it('evaluates count', () => {
      expect(evaluate(['count', '@entity.items'], ctx)).toBe(2);
      expect(evaluate(['count', [1, 2, 3]], ctx)).toBe(3);
    });

    it('evaluates first/last', () => {
      expect(evaluate(['first', '@entity.items'], ctx)).toBe('sword');
      expect(evaluate(['last', '@entity.items'], ctx)).toBe('shield');
    });

    it('evaluates nth', () => {
      expect(evaluate(['nth', '@entity.items', 0], ctx)).toBe('sword');
      expect(evaluate(['nth', '@entity.items', 1], ctx)).toBe('shield');
    });

    it('evaluates includes', () => {
      expect(evaluate(['includes', '@entity.items', 'sword'], ctx)).toBe(true);
      expect(evaluate(['includes', '@entity.items', 'axe'], ctx)).toBe(false);
    });

    it('evaluates empty', () => {
      expect(evaluate(['empty', '@entity.items'], ctx)).toBe(false);
      expect(evaluate(['empty', []], ctx)).toBe(true);
    });

    it('evaluates concat', () => {
      const result = evaluate(['concat', [1, 2], [3, 4]], ctx);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('evaluates map', () => {
      ctx = { ...ctx, entity: { ...ctx.entity, numbers: [1, 2, 3] } };
      const result = evaluate(
        ['map', '@entity.numbers', ['fn', 'x', ['*', '@x', 2]]],
        ctx
      );
      expect(result).toEqual([2, 4, 6]);
    });

    it('evaluates filter', () => {
      ctx = { ...ctx, entity: { ...ctx.entity, numbers: [1, 2, 3, 4, 5] } };
      const result = evaluate(
        ['filter', '@entity.numbers', ['fn', 'x', ['>', '@x', 2]]],
        ctx
      );
      expect(result).toEqual([3, 4, 5]);
    });

    it('evaluates find', () => {
      ctx = { ...ctx, entity: { ...ctx.entity, numbers: [1, 2, 3, 4, 5] } };
      const result = evaluate(
        ['find', '@entity.numbers', ['fn', 'x', ['>', '@x', 3]]],
        ctx
      );
      expect(result).toBe(4);
    });

    it('evaluates sum', () => {
      ctx = { ...ctx, entity: { ...ctx.entity, numbers: [1, 2, 3, 4, 5] } };
      expect(evaluate(['sum', '@entity.numbers'], ctx)).toBe(15);
    });
  });

  // ============================================================================
  // Effect Operators
  // ============================================================================

  describe('effects', () => {
    it('evaluates set effect', () => {
      const mutate = vi.fn();
      const effectCtx = createEffectContext(ctx, { mutateEntity: mutate });

      executeEffect(['set', '@entity.health', 50], effectCtx);

      expect(mutate).toHaveBeenCalledWith({ health: 50 });
    });

    it('evaluates emit effect', () => {
      const emit = vi.fn();
      const effectCtx = createEffectContext(ctx, { emit });

      executeEffect(['emit', 'PLAYER_DAMAGED', { amount: 25 }], effectCtx);

      expect(emit).toHaveBeenCalledWith('PLAYER_DAMAGED', { amount: 25 });
    });

    it('evaluates navigate effect', () => {
      const navigate = vi.fn();
      const effectCtx = createEffectContext(ctx, { navigate });

      executeEffect(['navigate', '/game-over'], effectCtx);

      expect(navigate).toHaveBeenCalledWith('/game-over', undefined);
    });

    it('evaluates notify effect', () => {
      const notify = vi.fn();
      const effectCtx = createEffectContext(ctx, { notify });

      executeEffect(['notify', 'Game saved!', 'success'], effectCtx);

      expect(notify).toHaveBeenCalledWith('Game saved!', 'success');
    });

    it('evaluates spawn effect', () => {
      const spawn = vi.fn();
      const effectCtx = createEffectContext(ctx, { spawn });

      executeEffect(['spawn', 'Enemy', { x: 100, y: 200 }], effectCtx);

      expect(spawn).toHaveBeenCalledWith('Enemy', { x: 100, y: 200 });
    });

    it('evaluates despawn effect', () => {
      const despawn = vi.fn();
      const effectCtx = createEffectContext(ctx, { despawn });

      executeEffect(['despawn', 'enemy-1'], effectCtx);

      expect(despawn).toHaveBeenCalledWith('enemy-1');
    });

    it('evaluates render-ui effect', () => {
      const renderUI = vi.fn();
      const effectCtx = createEffectContext(ctx, { renderUI });

      executeEffect(['render-ui', 'main', { type: 'page-header', title: 'Hello' }], effectCtx);

      // render-ui calls with 4 args: slot, pattern, props, priority
      expect(renderUI).toHaveBeenCalledWith('main', { type: 'page-header', title: 'Hello' }, undefined, undefined);
    });
  });

  // ============================================================================
  // Guard Evaluation
  // ============================================================================

  describe('guards', () => {
    it('evaluateGuard returns boolean', () => {
      expect(evaluateGuard(['>', '@entity.health', 0], ctx)).toBe(true);
      expect(evaluateGuard(['>', '@entity.health', 200], ctx)).toBe(false);
    });

    it('guards block transitions correctly', () => {
      // Simulate checking if transition should be allowed
      const lowHealthCtx = createMinimalContext({ health: 0 });
      expect(evaluateGuard(['>', '@entity.health', 0], lowHealthCtx)).toBe(false);
    });

    it('complex guards work', () => {
      // ["and", [">", "@entity.health", 0], ["<", "@payload.damage", 100]]
      const guard = ['and', ['>', '@entity.health', 0], ['<', '@payload.damage', 100]];
      expect(evaluateGuard(guard, ctx)).toBe(true);
    });
  });

  // ============================================================================
  // Nested Expressions
  // ============================================================================

  describe('nested expressions', () => {
    it('evaluates deeply nested arithmetic', () => {
      // (1 + (2 * (3 + 4)))
      expect(evaluate(['+', 1, ['*', 2, ['+', 3, 4]]], ctx)).toBe(15);
    });

    it('evaluates complex guards', () => {
      // ["or", ["and", [">", "@entity.health", 50], ["<", "@entity.health", 100]], ["=", "@state", "invincible"]]
      const guard = [
        'or',
        ['and', ['>', '@entity.health', 50], ['<', '@entity.health', 200]],
        ['=', '@state', 'invincible'],
      ];
      expect(evaluateGuard(guard, ctx)).toBe(true);
    });

    it('evaluates physics update expression', () => {
      // new_x = x + vx * dt
      ctx.singletons.set('GameConfig', { dt: 0.016 });
      const expr = ['+', '@entity.x', ['*', 5, '@GameConfig.dt']];
      expect(evaluate(expr, ctx)).toBeCloseTo(10.08);
    });
  });

  // ============================================================================
  // JIT Compilation Cache
  // ============================================================================

  describe('JIT cache', () => {
    it('compile returns a function', () => {
      const fn = evaluator.compile(['>', '@entity.health', 0]);
      expect(typeof fn).toBe('function');
      expect(fn(ctx)).toBe(true);
    });

    it('cached function produces same result', () => {
      const fn1 = evaluator.compile(['+', '@entity.x', '@entity.y']);
      const fn2 = evaluator.compile(['+', '@entity.x', '@entity.y']);

      expect(fn1(ctx)).toBe(30);
      expect(fn2(ctx)).toBe(30);
    });

    it('clearCache clears the cache', () => {
      evaluator.compile(['+', 1, 2]);
      evaluator.clearCache();
      // After clearing, should still work (recompile)
      const fn = evaluator.compile(['+', 1, 2]);
      expect(fn(ctx)).toBe(3);
    });
  });

  // ============================================================================
  // Execute Effects (Batch)
  // ============================================================================

  describe('executeEffects', () => {
    it('executes multiple effects in sequence', () => {
      const calls: string[] = [];
      const effectCtx = createEffectContext(ctx, {
        mutateEntity: (changes) => calls.push(`set:${JSON.stringify(changes)}`),
        emit: (event) => calls.push(`emit:${event}`),
      });

      executeEffects(
        [
          ['set', '@entity.x', 100],
          ['emit', 'MOVED'],
          ['set', '@entity.y', 200],
        ],
        effectCtx
      );

      expect(calls).toEqual([
        'set:{"x":100}',
        'emit:MOVED',
        'set:{"y":200}',
      ]);
    });
  });
});
