/**
 * Evaluation Context
 *
 * Defines the context for evaluating S-expressions at runtime.
 * This context provides access to entity data, payload, state, and effect handlers.
 *
 * @packageDocumentation
 */

import type { AgentContext, LlmContext, WorkspaceContext, SessionContext, MemoryContext, TraceContext, IntegrationContext, TraitConfig, NavItem, EntityRow, EventPayload, FieldValue, RuntimeValue } from '@almadar/core';
import type { SExpr } from './types/expression.js';

/**
 * User context for `@user` bindings — owned by `@almadar/core` so the
 * interpreter and the compiled shell resolve the same field names.
 */
export type { UserContext } from '@almadar/core';
import type { UserContext } from '@almadar/core';

/**
 * Evaluation context for S-expression evaluation.
 * Provides all bindings and effect handlers needed at runtime.
 */
export interface EvaluationContext {
  /** Entity data for @entity bindings */
  entity: EntityRow;

  /** Payload data for @payload bindings */
  payload: EventPayload;

  /** Current state for @state binding */
  state: string;

  /** Current timestamp for @now binding (defaults to Date.now()) */
  now: number;

  /** User data for @user bindings (role-based UI) */
  user?: UserContext;

  /** Singleton entities for @EntityName bindings */
  singletons: Map<string, EntityRow>;

  /** Local variables from 'let' bindings */
  locals?: Map<string, RuntimeValue>;

  /**
   * Call-site trait config for @config bindings. Populated by
   * `OrbitalServerRuntime.executeEffects` from `RegisteredOrbital.configByTrait`.
   * Molecules parameterize imported atoms through `config: { ... }` on the
   * trait ref; the atom's render-ui reads `@config.icon`, `@config.title`, etc.
   */
  config?: TraitConfig;

  /**
   * The host orbital's pages as a `NavItem[]` for the `@pages` render sigil
   * (`href = page.path`, `label = page.name`). Seeded into the render binding
   * context only — never present on a guard context (`createMinimalContext`),
   * so the sigil is render-resolved exactly like the compiler's
   * `OirBindingRoot::Pages`. Mirrors `@currentTheme` / the compiler's
   * post-pass substitution in `resolve_to_oir`.
   */
  pages?: NavItem[];

  /**
   * The `data-theme` selector-key string for the `@currentTheme` render sigil,
   * derived from the host orbital's `Orbital.theme` (a `ThemeRef` name).
   * Render-resolved only (never on a guard context). The knob that consumes
   * it stays `string` — the renderer applies the theme via the `data-theme`
   * attribute + CSS `[data-theme="..."]` blocks.
   */
  currentTheme?: string;

  /**
   * When true, log warnings when bindings resolve to undefined. (RCG-01)
   * Helps detect typos and missing entity fields early.
   */
  strictBindings?: boolean;

  /**
   * Set by prob/condition when a predicate fails during inference.
   * Checked by prob/posterior and prob/infer to reject samples.
   */
  _probRejected?: boolean;

  /**
   * Seeded PRNG state for deterministic probabilistic sampling.
   * Stored as a mutable object so child contexts share the same state.
   * Set by prob/seed.
   */
  _probSeed?: { state: number };

  /** Agent context for agent/* operators (memory, LLM, tools, session) */
  agent?: AgentContext;

  /** Substrate contexts for llm/*, workspace/*, session/*, memory/*, trace/*, integration/* operators */
  llm?: LlmContext;
  workspace?: WorkspaceContext;
  session?: SessionContext;
  memory?: MemoryContext;
  trace?: TraceContext;
  integration?: IntegrationContext;

  // ============================================================================
  // Effect Handlers (for executing side effects)
  // ============================================================================

  /** Mutate entity fields */
  mutateEntity?: (changes: Record<string, RuntimeValue>) => void;

  /** Emit an event */
  emit?: (event: string, payload?: RuntimeValue) => void;

  /** Navigate to a route */
  navigate?: (route: string, params?: Record<string, RuntimeValue>) => void;

  /** Persist data (create/update/delete/batch) */
  persist?: (action: 'create' | 'update' | 'delete' | 'batch', data?: Record<string, RuntimeValue>) => Promise<void>;

  /** Show a notification */
  notify?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

  /** Spawn a new entity instance */
  spawn?: (entityType: string, props?: Record<string, RuntimeValue>) => void;

  /** Despawn an entity instance */
  despawn?: (entityId?: string) => void;

  /** Call an external service */
  callService?: (service: string, method: string, params?: Record<string, RuntimeValue>) => Promise<RuntimeValue>;

  /** Render UI to a slot */
  renderUI?: (slot: string, pattern: RuntimeValue, props?: Record<string, RuntimeValue>, priority?: number) => void;

  /** Register an OS trigger (server-side only) */
  registerOsTrigger?: (type: string, config: Record<string, RuntimeValue>) => void;

  // ============================================================================
  // Resource Operators (ref/deref/swap!/watch/atomic)
  // ============================================================================

  /** Effect handlers for resource operators (grouped to avoid top-level pollution) */
  effectHandlers?: {
    ref?: (entityType: string, options?: RuntimeValue) => RuntimeValue;
    deref?: (entityType: string, id?: RuntimeValue) => RuntimeValue;
    swap?: (entityType: string, id: RuntimeValue, transformExpr: SExpr, evaluate: Evaluator, ctx: EvaluationContext) => RuntimeValue;
    watch?: (entityType: string, effects: SExpr[], evaluate: Evaluator, ctx: EvaluationContext) => void;
    atomic?: (effects: SExpr[], evaluate: Evaluator, ctx: EvaluationContext) => RuntimeValue;
    fetch?: (entityType: string, options?: RuntimeValue) => RuntimeValue;
  };
}

/**
 * The function operator implementations receive to evaluate child
 * expressions — the interpreter's `evaluate` or a compiled tree's
 * child-dispatch; both share this contract.
 */
export type Evaluator = (expr: SExpr, ctx: EvaluationContext) => RuntimeValue;

/**
 * Create a minimal evaluation context for testing/guards.
 * Only includes bindings, no effect handlers.
 */
export function createMinimalContext(
  entity: EntityRow = {},
  payload: EventPayload = {},
  state: string = 'initial'
): EvaluationContext {
  return {
    entity,
    payload,
    state,
    now: Date.now(),
    singletons: new Map(),
  };
}

/**
 * Create a context with effect handlers.
 * Used for runtime evaluation where effects need to execute.
 */
export function createEffectContext(
  base: EvaluationContext,
  handlers: Partial<Pick<EvaluationContext,
    'mutateEntity' | 'emit' | 'navigate' | 'persist' | 'notify' | 'spawn' | 'despawn' | 'callService' | 'renderUI'
  >>
): EvaluationContext {
  return {
    ...base,
    ...handlers,
  };
}

/**
 * Create a child context with additional local bindings.
 * Used for 'let' expressions.
 */
export function createChildContext(
  parent: EvaluationContext,
  locals: Map<string, RuntimeValue>
): EvaluationContext {
  // Merge parent locals with new locals
  const mergedLocals = new Map(parent.locals);
  locals.forEach((value, key) => mergedLocals.set(key, value));

  return {
    ...parent,
    locals: mergedLocals,
  };
}

/**
 * Resolve a binding in the context.
 *
 * @param binding - Binding string (e.g., "@entity.health", "@payload.amount")
 * @param ctx - Evaluation context
 * @returns Resolved value or undefined
 */
/**
 * Binding roots whose values only exist in client UI state (e.g. `@trait.*`
 * resolves to another trait's current `render-ui` output, which lives in
 * `@almadar/ui`'s slot manager, not on the server). Evaluator returns
 * `undefined` for these without emitting a strict-mode warning — they're
 * expected to round-trip through the server verbatim and be substituted at
 * render time. Mirrors `CLIENT_ONLY_BINDING_ROOTS` in
 * `@almadar/runtime/BindingResolver`.
 */
const CLIENT_ONLY_BINDING_ROOTS: ReadonlySet<string> = new Set(['trait']);

/**
 * Pre-parsed binding paths. Binding strings are schema-authored and finite,
 * so the parse (split + bracket-index regex expansion) is cached forever
 * rather than re-run per resolution — the single hottest evaluator helper
 * on tick-heavy boards (R-EVALUATOR-JIT-IS-A-WRAPPER).
 */
const PARSED_PATH_CACHE = new Map<string, { root: string; path: readonly string[] }>();

function parseBindingPath(withoutPrefix: string): { root: string; path: readonly string[] } {
  const cached = PARSED_PATH_CACHE.get(withoutPrefix);
  if (cached) return cached;
  // Split on `.` but also expand bracket-index segments into separate
  // path steps. `config.sections[0].bullets` -> ['config', 'sections',
  // '0', 'bullets']. Indices are numeric strings; the navigation loop
  // below handles them transparently against arrays (Array['0'] reads
  // index 0). Lolos use bracket notation to address typed config
  // arrays (e.g. `@config.sections[0].title` on a per-section split-
  // section pattern); without this expansion the segment 'sections[0]'
  // is looked up as a literal property name and resolves to undefined.
  const parts = withoutPrefix.split('.').flatMap((seg) => {
    const m = seg.match(/^([\w]+)((?:\[\d+\])+)$/);
    if (!m) return [seg];
    const head = m[1];
    const indices = Array.from(m[2].matchAll(/\[(\d+)\]/g)).map((x) => x[1]);
    return [head, ...indices];
  });
  const parsed = { root: parts[0], path: parts.slice(1) };
  PARSED_PATH_CACHE.set(withoutPrefix, parsed);
  return parsed;
}

export function resolveBinding(binding: string, ctx: EvaluationContext): RuntimeValue {
  if (!binding.startsWith('@')) {
    return undefined;
  }

  const { root, path } = parseBindingPath(binding.slice(1));

  // Client-only bindings never resolve server-side. Short-circuit so
  // strict-mode warnings don't fire on intentional-unresolved paths.
  if (CLIENT_ONLY_BINDING_ROOTS.has(root)) {
    return undefined;
  }

  let value: RuntimeValue;

  // Check locals first
  if (ctx.locals?.has(root)) {
    value = ctx.locals.get(root);
  } else {
    // Core bindings
    switch (root) {
      case 'entity':
        value = ctx.entity;
        break;
      case 'payload':
        value = ctx.payload;
        break;
      case 'state':
        return ctx.state; // @state has no path
      case 'now':
        return ctx.now; // @now has no path
      case 'user':
        value = ctx.user;
        break;
      case 'config':
        // Call-site trait config injected by OrbitalServerRuntime (see
        // RegisteredOrbital.configByTrait). Molecules parameterize imported
        // atoms through `config: { ... }` on the trait ref; the atom's
        // render-ui reads `@config.icon`, `@config.title`, etc.
        value = ctx.config;
        break;
      case 'pages':
        // Render-resolved schema sigil — the host orbital's pages as
        // `NavItem[]`. Bare root (no path); seeded onto the render binding
        // context only.
        return ctx.pages;
      case 'currentTheme':
        // Render-resolved schema sigil — the `data-theme` key string derived
        // from `Orbital.theme`. Bare root (no path); render-context only.
        return ctx.currentTheme;
      default:
        // Singleton entity reference (@EntityName.field)
        value = ctx.singletons.get(root);
        break;
    }
  }

  // Navigate path
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (value === null || value === undefined) {
      if (ctx.strictBindings) {
        const resolvedSoFar = [root, ...path.slice(0, i)].join('.');
        console.warn(
          `[Binding] @${root}.${path.join('.')} resolved to undefined ` +
          `(failed at "${segment}" — @${resolvedSoFar} is ${value === null ? 'null' : 'undefined'})`
        );
      }
      return undefined;
    }
    if (typeof value === 'object') {
      value = (value as Record<string, RuntimeValue>)[segment];
    } else {
      if (ctx.strictBindings) {
        const resolvedSoFar = [root, ...path.slice(0, i)].join('.');
        console.warn(
          `[Binding] @${root}.${path.join('.')} resolved to undefined ` +
          `(cannot navigate "${segment}" on non-object at @${resolvedSoFar})`
        );
      }
      return undefined;
    }
  }

  if (value === undefined && path.length > 0 && ctx.strictBindings) {
    console.warn(
      `[Binding] @${root}.${path.join('.')} resolved to undefined`
    );
  }

  return value;
}
