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
        ['map', '@entity.numbers', ['*', '@item', 2]],
        ctx
      );
      expect(result).toEqual([2, 4, 6]);
    });

    it('evaluates filter', () => {
      ctx = { ...ctx, entity: { ...ctx.entity, numbers: [1, 2, 3, 4, 5] } };
      const result = evaluate(
        ['filter', '@entity.numbers', ['>', '@item', 2]],
        ctx
      );
      expect(result).toEqual([3, 4, 5]);
    });

    it('evaluates find', () => {
      ctx = { ...ctx, entity: { ...ctx.entity, numbers: [1, 2, 3, 4, 5] } };
      const result = evaluate(
        ['find', '@entity.numbers', ['>', '@item', 3]],
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

  // ============================================================================
  // fn / lambda Operator
  // ============================================================================

  describe('fn / lambda', () => {
    it('fn returns a function', () => {
      const result = evaluate(['fn', 'x', ['+', '@x', 1]], ctx);
      expect(typeof result).toBe('function');
    });

    it('lambda is an alias for fn', () => {
      const result = evaluate(['lambda', 'x', ['*', '@x', 2]], ctx);
      expect(typeof result).toBe('function');
    });

    it('fn with single param works with array/map', () => {
      const result = evaluate(
        ['array/map', [1, 2, 3], ['fn', 'x', ['*', '@x', 2]]],
        ctx
      );
      expect(result).toEqual([2, 4, 6]);
    });

    it('fn with single param works with array/filter', () => {
      const result = evaluate(
        ['array/filter', [1, 2, 3, 4, 5], ['fn', 'x', ['>', '@x', 3]]],
        ctx
      );
      expect(result).toEqual([4, 5]);
    });

    it('fn with single param works with array/find', () => {
      const result = evaluate(
        ['array/find', [1, 2, 3, 4], ['fn', 'x', ['>', '@x', 2]]],
        ctx
      );
      expect(result).toBe(3);
    });

    it('fn with multi params works with array/reduce', () => {
      const result = evaluate(
        ['array/reduce', [1, 2, 3, 4], 0, ['fn', ['acc', 'x'], ['+', '@acc', '@x']]],
        ctx
      );
      expect(result).toBe(10);
    });

    it('fn with array/every', () => {
      const result = evaluate(
        ['array/every', [2, 4, 6], ['fn', 'x', ['=', ['%', '@x', 2], 0]]],
        ctx
      );
      expect(result).toBe(true);
    });

    it('fn with array/some', () => {
      const result = evaluate(
        ['array/some', [1, 3, 4], ['fn', 'x', ['=', ['%', '@x', 2], 0]]],
        ctx
      );
      expect(result).toBe(true);
    });

    it('fn with object/filter (two params: key, value)', () => {
      const result = evaluate(
        ['object/filter', { a: 1, b: 0, c: 3 }, ['fn', ['k', 'v'], ['>', '@v', 0]]],
        ctx
      );
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('fn with object/mapValues', () => {
      const result = evaluate(
        ['object/mapValues', { a: 1, b: 2 }, ['fn', 'v', ['*', '@v', 10]]],
        ctx
      );
      expect(result).toEqual({ a: 10, b: 20 });
    });

    it('nested fn (fn returning fn result)', () => {
      // Map over array, filter result
      const result = evaluate(
        ['array/filter',
          ['array/map', [1, 2, 3, 4, 5], ['fn', 'x', ['*', '@x', 2]]],
          ['fn', 'x', ['>', '@x', 5]]
        ],
        ctx
      );
      expect(result).toEqual([6, 8, 10]);
    });

    it('fn inside if conditional', () => {
      const result = evaluate(
        ['if', true,
          ['array/map', [1, 2, 3], ['fn', 'x', ['+', '@x', 10]]],
          [0]
        ],
        ctx
      );
      expect(result).toEqual([11, 12, 13]);
    });

    it('fn inside let binding', () => {
      const result = evaluate(
        ['let', [['data', [1, 2, 3, 4, 5]]],
          ['array/filter', '@data', ['fn', 'x', ['>', '@x', 3]]]
        ],
        ctx
      );
      expect(result).toEqual([4, 5]);
    });

    it('fn inside do block', () => {
      const result = evaluate(
        ['do',
          ['let', [['unused', 0]], 0],
          ['array/map', [10, 20, 30], ['fn', 'x', ['/', '@x', 10]]]
        ],
        ctx
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('complex: reduce with multi-param fn and nested arithmetic', () => {
      // Sum of squares: reduce([1,2,3,4], 0, fn(acc,x) => acc + x*x)
      const result = evaluate(
        ['array/reduce', [1, 2, 3, 4], 0,
          ['fn', ['acc', 'x'], ['+', '@acc', ['*', '@x', '@x']]]
        ],
        ctx
      );
      expect(result).toBe(30); // 1+4+9+16
    });
  });

  // ============================================================================
  // Complex / Stress Tests
  // ============================================================================

  describe('complex expressions (stress tests)', () => {
    // --- Deep nesting ---

    it('deeply nested if/let/do chain', () => {
      // if(true, let(a=10, do(let(b=20, +(a,b)))), 0)
      const result = evaluate(
        ['if', true,
          ['let', [['a', 10]],
            ['do',
              ['let', [['b', 20]], ['+', '@a', '@b']]
            ]
          ],
          0
        ],
        ctx
      );
      expect(result).toBe(30);
    });

    it('5-level nested arithmetic', () => {
      // ((((1 + 2) * 3) - 4) / 5) + 6 = ((3*3 - 4) / 5) + 6 = (9-4)/5 + 6 = 1 + 6 = 7
      const result = evaluate(
        ['+', ['/', ['-', ['*', ['+', 1, 2], 3], 4], 5], 6],
        ctx
      );
      expect(result).toBe(7);
    });

    it('nested conditionals with bindings', () => {
      // if(health > 50, if(health > 80, "strong", "medium"), "weak")
      const result = evaluate(
        ['if', ['>', '@entity.health', 50],
          ['if', ['>', '@entity.health', 80], 'strong', 'medium'],
          'weak'
        ],
        ctx
      );
      expect(result).toBe('strong'); // health=100
    });

    it('triple-nested let bindings with shadowing', () => {
      const result = evaluate(
        ['let', [['x', 1]],
          ['let', [['y', ['+', '@x', 10]]],
            ['let', [['x', 100]], // shadow outer x
              ['+', '@x', '@y']   // x=100, y=11
            ]
          ]
        ],
        ctx
      );
      expect(result).toBe(111);
    });

    // --- Complex collection pipelines ---

    it('map then filter then reduce pipeline', () => {
      // [1..5] -> map(x*x) -> filter(>5) -> reduce(+, 0)
      // squares: [1,4,9,16,25] -> filter: [9,16,25] -> sum: 50
      const result = evaluate(
        ['array/reduce',
          ['array/filter',
            ['array/map', [1, 2, 3, 4, 5], ['fn', 'x', ['*', '@x', '@x']]],
            ['fn', 'x', ['>', '@x', 5]]
          ],
          0,
          ['fn', ['acc', 'x'], ['+', '@acc', '@x']]
        ],
        ctx
      );
      expect(result).toBe(50);
    });

    it('nested map producing objects then filtering', () => {
      // Map numbers to {val: n, doubled: n*2}, filter where doubled > 5
      const mapped = evaluate(
        ['array/map', [1, 2, 3, 4],
          ['fn', 'x', ['object/merge',
            ['object/set', {}, 'val', '@x'],
            ['object/set', {}, 'doubled', ['*', '@x', 2]]
          ]]
        ],
        ctx
      );
      expect(mapped).toEqual([
        { val: 1, doubled: 2 },
        { val: 2, doubled: 4 },
        { val: 3, doubled: 6 },
        { val: 4, doubled: 8 },
      ]);
    });

    it('groupBy then mapValues', () => {
      const data = [
        { name: 'a', type: 'x', score: 10 },
        { name: 'b', type: 'y', score: 20 },
        { name: 'c', type: 'x', score: 30 },
      ];
      // Group by type, then map each group to its length
      const grouped = evaluate(['array/groupBy', data, 'type'], ctx);
      expect(grouped).toEqual({
        x: [{ name: 'a', type: 'x', score: 10 }, { name: 'c', type: 'x', score: 30 }],
        y: [{ name: 'b', type: 'y', score: 20 }],
      });
    });

    // --- Conditional logic with collections ---

    it('if inside map lambda', () => {
      // Map [1,2,3,4,5] -> if x>3 then "big" else "small"
      const result = evaluate(
        ['array/map', [1, 2, 3, 4, 5],
          ['fn', 'x', ['if', ['>', '@x', 3], 'big', 'small']]
        ],
        ctx
      );
      expect(result).toEqual(['small', 'small', 'small', 'big', 'big']);
    });

    it('when inside do block', () => {
      const calls: string[] = [];
      const effectCtx = createEffectContext(ctx, {
        mutateEntity: (changes) => calls.push(`set:${JSON.stringify(changes)}`),
        emit: (event) => calls.push(`emit:${event}`),
      });

      evaluate(
        ['do',
          ['when', ['>', '@entity.health', 50], ['emit', 'HEALTHY']],
          ['when', ['<', '@entity.health', 50], ['emit', 'WOUNDED']],
          42
        ],
        effectCtx
      );

      expect(calls).toEqual(['emit:HEALTHY']);
    });

    // --- String + collection composition ---

    it('map objects to formatted strings', () => {
      // Build "name:score" strings from data
      const result = evaluate(
        ['array/map',
          [{ name: 'Alice', score: 95 }, { name: 'Bob', score: 87 }],
          ['fn', 'x',
            ['str/concat',
              ['object/get', '@x', 'name'],
              ':',
              ['to-string', ['object/get', '@x', 'score']]
            ]
          ]
        ],
        ctx
      );
      expect(result).toEqual(['Alice:95', 'Bob:87']);
    });

    it('filter + count pattern', () => {
      const result = evaluate(
        ['array/count',
          ['array/filter', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            ['fn', 'x', ['=', ['%', '@x', 2], 0]]
          ]
        ],
        ctx
      );
      expect(result).toBe(5); // 5 even numbers
    });

    // --- Mixed operator types ---

    it('math + comparison + logic + if + let composition', () => {
      // let(distance = sqrt(x*x + y*y), if(distance > 15, "far", "near"))
      const result = evaluate(
        ['let', [['distance', ['math/sqrt', ['+', ['*', '@entity.x', '@entity.x'], ['*', '@entity.y', '@entity.y']]]]],
          ['if', ['>', '@distance', 15], 'far', 'near']
        ],
        ctx
      );
      // distance = sqrt(100+400) = sqrt(500) = ~22.36
      expect(result).toBe('far');
    });

    it('clamp + lerp + round composition', () => {
      const result = evaluate(
        ['math/round', ['math/lerp', 0, 100, ['math/clamp', 0.75, 0, 1]]],
        ctx
      );
      expect(result).toBe(75);
    });

    // --- Edge cases ---

    it('empty array operations', () => {
      expect(evaluate(['array/map', [], ['fn', 'x', ['*', '@x', 2]]], ctx)).toEqual([]);
      expect(evaluate(['array/filter', [], ['fn', 'x', true]], ctx)).toEqual([]);
      expect(evaluate(['array/reduce', [], 0, ['fn', ['a', 'x'], ['+', '@a', '@x']]], ctx)).toBe(0);
      expect(evaluate(['array/find', [], ['fn', 'x', true]], ctx)).toBeUndefined();
    });

    it('single element array operations', () => {
      expect(evaluate(['array/map', [42], ['fn', 'x', ['*', '@x', 2]]], ctx)).toEqual([84]);
      expect(evaluate(['array/filter', [42], ['fn', 'x', ['>', '@x', 100]]], ctx)).toEqual([]);
      expect(evaluate(['array/reduce', [42], 0, ['fn', ['a', 'x'], ['+', '@a', '@x']]], ctx)).toBe(42);
    });

    it('nested object/get chains', () => {
      const data = { user: { profile: { name: 'Test' } } };
      const result = evaluate(
        ['object/get', ['object/get', ['object/get', data, 'user'], 'profile'], 'name'],
        ctx
      );
      expect(result).toBe('Test');
    });

    it('boolean logic chains', () => {
      // (health > 0) AND ((x > 0) OR (y > 0)) AND NOT(health = 0)
      const result = evaluate(
        ['and',
          ['>', '@entity.health', 0],
          ['or', ['>', '@entity.x', 0], ['>', '@entity.y', 0]],
          ['not', ['=', '@entity.health', 0]]
        ],
        ctx
      );
      expect(result).toBe(true);
    });

    it('do block returns last expression', () => {
      const result = evaluate(
        ['do',
          ['+', 1, 2],       // 3 (ignored)
          ['*', 3, 4],       // 12 (ignored)
          ['-', 100, 1]      // 99 (returned)
        ],
        ctx
      );
      expect(result).toBe(99);
    });

    it('let with computed bindings referencing earlier bindings', () => {
      // let(a=5, let(b=a*2, let(c=a+b, c)))
      // a=5, b=10, c=15
      const result = evaluate(
        ['let', [['a', 5]],
          ['let', [['b', ['*', '@a', 2]]],
            ['let', [['c', ['+', '@a', '@b']]],
              '@c'
            ]
          ]
        ],
        ctx
      );
      expect(result).toBe(15);
    });

    // --- Validate + conditional ---

    it('validate inside conditional logic', () => {
      const result = evaluate(
        ['if',
          ['and',
            ['validate/email', 'user@example.com'],
            ['validate/minLength', 'user@example.com', 5]
          ],
          'valid',
          'invalid'
        ],
        ctx
      );
      expect(result).toBe('valid');
    });

    // --- Time expressions ---

    it('time comparison chain', () => {
      const now = evaluate(['time/now'], ctx) as string;
      const isPast = evaluate(['time/isPast', ['time/subtract', now, 1, 'day']], ctx);
      const isFuture = evaluate(['time/isFuture', ['time/add', now, 1, 'day']], ctx);
      expect(isPast).toBe(true);
      expect(isFuture).toBe(true);
    });

    // --- Fibonacci via reduce ---

    it('fibonacci-like via reduce', () => {
      // Use reduce to generate fibonacci: reduce over range, accumulate [a,b] pairs
      // This tests multi-step reduce with array accumulator
      const result = evaluate(
        ['array/reduce',
          [1, 2, 3, 4, 5, 6], // 6 iterations
          [0, 1],              // initial: [fib(0), fib(1)]
          ['fn', ['pair', 'i'],
            ['let', [
              ['a', ['array/first', '@pair']],
              ['b', ['array/last', '@pair']]
            ],
              ['array/append',
                ['array/slice', '@pair', 1],  // drop first: [b]
                ['+', '@a', '@b']             // append a+b
              ]
            ]
          ]
        ],
        ctx
      );
      // After 6 iterations starting from [0,1]:
      // [1,1] -> [1,2] -> [2,3] -> [3,5] -> [5,8] -> [8,13]
      expect(result).toEqual([8, 13]);
    });

    // --- Object construction via reduce ---

    it('build object from array via reduce', () => {
      // reduce(['a','b','c'], {}, fn(acc,x) => object/set(acc, x, str/upper(x)))
      const result = evaluate(
        ['array/reduce',
          ['str/split', 'a,b,c', ','],
          {},
          ['fn', ['acc', 'x'],
            ['object/set', '@acc', '@x', ['str/upper', '@x']]
          ]
        ],
        ctx
      );
      expect(result).toEqual({ a: 'A', b: 'B', c: 'C' });
    });
  });
});
