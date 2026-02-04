/**
 * Evaluation Context Tests
 *
 * Tests for context creation, binding resolution, and user context functionality.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  createMinimalContext,
  createEffectContext,
  createChildContext,
  resolveBinding,
  type EvaluationContext,
  type UserContext,
} from '../context.js';

// ============================================================================
// Context Creation
// ============================================================================

describe('Context Creation', () => {
  describe('createMinimalContext', () => {
    it('creates context with default values', () => {
      const ctx = createMinimalContext();

      expect(ctx.entity).toEqual({});
      expect(ctx.payload).toEqual({});
      expect(ctx.state).toBe('initial');
      expect(typeof ctx.now).toBe('number');
      expect(ctx.singletons).toBeInstanceOf(Map);
      expect(ctx.singletons.size).toBe(0);
    });

    it('creates context with provided values', () => {
      const entity = { id: '123', name: 'Test' };
      const payload = { amount: 50 };
      const ctx = createMinimalContext(entity, payload, 'active');

      expect(ctx.entity).toEqual(entity);
      expect(ctx.payload).toEqual(payload);
      expect(ctx.state).toBe('active');
    });

    it('does not include effect handlers', () => {
      const ctx = createMinimalContext();

      expect(ctx.mutateEntity).toBeUndefined();
      expect(ctx.emit).toBeUndefined();
      expect(ctx.navigate).toBeUndefined();
      expect(ctx.persist).toBeUndefined();
      expect(ctx.notify).toBeUndefined();
      expect(ctx.spawn).toBeUndefined();
      expect(ctx.despawn).toBeUndefined();
      expect(ctx.callService).toBeUndefined();
      expect(ctx.renderUI).toBeUndefined();
    });
  });

  describe('createEffectContext', () => {
    it('adds effect handlers to base context', () => {
      const base = createMinimalContext();
      const handlers = {
        mutateEntity: () => {},
        emit: () => {},
        navigate: () => {},
      };

      const ctx = createEffectContext(base, handlers);

      expect(ctx.mutateEntity).toBeDefined();
      expect(ctx.emit).toBeDefined();
      expect(ctx.navigate).toBeDefined();
      // Base properties preserved
      expect(ctx.entity).toEqual(base.entity);
      expect(ctx.state).toBe(base.state);
    });
  });

  describe('createChildContext', () => {
    it('creates child with merged locals', () => {
      const parent = createMinimalContext();
      parent.locals = new Map([['x', 10], ['y', 20]]);

      const childLocals = new Map([['z', 30], ['x', 100]]);
      const child = createChildContext(parent, childLocals);

      expect(child.locals?.get('x')).toBe(100); // Overridden
      expect(child.locals?.get('y')).toBe(20); // From parent
      expect(child.locals?.get('z')).toBe(30); // New
    });

    it('preserves base context properties', () => {
      const parent = createMinimalContext({ id: '123' }, { action: 'test' }, 'running');
      const child = createChildContext(parent, new Map());

      expect(child.entity).toEqual({ id: '123' });
      expect(child.payload).toEqual({ action: 'test' });
      expect(child.state).toBe('running');
    });
  });
});

// ============================================================================
// Binding Resolution
// ============================================================================

describe('resolveBinding', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext(
      { health: 100, position: { x: 10, y: 20 } },
      { damage: 25 },
      'active'
    );
  });

  describe('@entity bindings', () => {
    it('resolves simple entity fields', () => {
      expect(resolveBinding('@entity.health', ctx)).toBe(100);
    });

    it('resolves nested entity fields', () => {
      expect(resolveBinding('@entity.position.x', ctx)).toBe(10);
      expect(resolveBinding('@entity.position.y', ctx)).toBe(20);
    });

    it('returns undefined for missing fields', () => {
      expect(resolveBinding('@entity.unknown', ctx)).toBeUndefined();
      expect(resolveBinding('@entity.position.z', ctx)).toBeUndefined();
    });
  });

  describe('@payload bindings', () => {
    it('resolves payload fields', () => {
      expect(resolveBinding('@payload.damage', ctx)).toBe(25);
    });
  });

  describe('@state binding', () => {
    it('resolves state directly (no path)', () => {
      expect(resolveBinding('@state', ctx)).toBe('active');
    });
  });

  describe('@now binding', () => {
    it('resolves to current timestamp', () => {
      const result = resolveBinding('@now', ctx);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('@user bindings', () => {
    it('resolves user fields when user is set', () => {
      ctx.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: ['read', 'write'],
      };

      expect(resolveBinding('@user.id', ctx)).toBe('user-123');
      expect(resolveBinding('@user.email', ctx)).toBe('test@example.com');
      expect(resolveBinding('@user.name', ctx)).toBe('Test User');
      expect(resolveBinding('@user.role', ctx)).toBe('admin');
      expect(resolveBinding('@user.permissions', ctx)).toEqual(['read', 'write']);
    });

    it('returns undefined when user is not set', () => {
      expect(resolveBinding('@user.id', ctx)).toBeUndefined();
      expect(resolveBinding('@user.role', ctx)).toBeUndefined();
    });

    it('resolves nested user fields', () => {
      ctx.user = {
        id: 'user-123',
        profile: {
          avatar: 'avatar.png',
          preferences: {
            theme: 'dark',
            language: 'en',
          },
        },
      };

      expect(resolveBinding('@user.profile.avatar', ctx)).toBe('avatar.png');
      expect(resolveBinding('@user.profile.preferences.theme', ctx)).toBe('dark');
      expect(resolveBinding('@user.profile.preferences.language', ctx)).toBe('en');
    });

    it('supports custom user fields', () => {
      ctx.user = {
        id: 'user-123',
        customField: 'custom value',
        metadata: {
          createdAt: '2024-01-01',
        },
      };

      expect(resolveBinding('@user.customField', ctx)).toBe('custom value');
      expect(resolveBinding('@user.metadata.createdAt', ctx)).toBe('2024-01-01');
    });
  });

  describe('singleton bindings', () => {
    it('resolves singleton entity fields', () => {
      ctx.singletons.set('Config', { apiUrl: 'https://api.example.com', timeout: 5000 });

      expect(resolveBinding('@Config.apiUrl', ctx)).toBe('https://api.example.com');
      expect(resolveBinding('@Config.timeout', ctx)).toBe(5000);
    });

    it('returns undefined for unknown singletons', () => {
      expect(resolveBinding('@Unknown.field', ctx)).toBeUndefined();
    });
  });

  describe('local bindings', () => {
    it('resolves local variables', () => {
      ctx.locals = new Map<string, unknown>([['temp', 42], ['name', 'local']]);

      expect(resolveBinding('@temp', ctx)).toBe(42);
      expect(resolveBinding('@name', ctx)).toBe('local');
    });

    it('locals take precedence over singletons', () => {
      ctx.locals = new Map([['Config', { local: true }]]);
      ctx.singletons.set('Config', { local: false });

      const result = resolveBinding('@Config', ctx);
      expect(result).toEqual({ local: true });
    });
  });

  describe('edge cases', () => {
    it('returns undefined for non-@ prefixed strings', () => {
      expect(resolveBinding('entity.health', ctx)).toBeUndefined();
      expect(resolveBinding('health', ctx)).toBeUndefined();
    });

    it('handles null values in path', () => {
      ctx.entity = { nested: null };
      expect(resolveBinding('@entity.nested.field', ctx)).toBeUndefined();
    });

    it('handles undefined values in path', () => {
      ctx.entity = { nested: undefined };
      expect(resolveBinding('@entity.nested.field', ctx)).toBeUndefined();
    });
  });
});

// ============================================================================
// UserContext Interface
// ============================================================================

describe('UserContext Interface', () => {
  it('supports required id field', () => {
    const user: UserContext = { id: 'user-123' };
    expect(user.id).toBe('user-123');
  });

  it('supports optional standard fields', () => {
    const user: UserContext = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      permissions: ['read', 'write', 'delete'],
    };

    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('admin');
    expect(user.permissions).toEqual(['read', 'write', 'delete']);
  });

  it('supports custom fields via index signature', () => {
    const user: UserContext = {
      id: 'user-123',
      customField: 'custom value',
      nestedData: { key: 'value' },
      numericField: 42,
    };

    expect(user.customField).toBe('custom value');
    expect(user.nestedData).toEqual({ key: 'value' });
    expect(user.numericField).toBe(42);
  });
});
