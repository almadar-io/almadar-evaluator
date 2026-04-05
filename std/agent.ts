/**
 * Agent Module Runtime Evaluators
 *
 * Runtime implementations for agent/* operators.
 * Pure operators return safe defaults when ctx.agent is undefined.
 * Effect operators return null when ctx.agent is undefined.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import type { AgentMemoryCategory, AgentCompactStrategy, AgentGenerateOptions } from '@almadar/core';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

// ============================================================================
// Memory (Pure)
// ============================================================================

/**
 * agent/recall - Search memories by query
 */
export function evalAgentRecall(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  if (!ctx.agent) return [];
  const query = evaluate(args[0], ctx) as string;
  const limit = args.length > 1 ? (evaluate(args[1], ctx) as number) : undefined;
  return ctx.agent.recall(query, limit);
}

/**
 * agent/memories - List memories, optionally filtered by category
 */
export function evalAgentMemories(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  if (!ctx.agent) return [];
  const category = args.length > 0
    ? (evaluate(args[0], ctx) as AgentMemoryCategory)
    : undefined;
  return ctx.agent.memories(category);
}

/**
 * agent/memory-strength - Get strength value for a memory
 */
export function evalAgentMemoryStrength(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  if (!ctx.agent) return 0;
  const id = evaluate(args[0], ctx) as string;
  return ctx.agent.memoryStrength(id);
}

/**
 * agent/is-pinned - Check if a memory is pinned
 */
export function evalAgentIsPinned(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  if (!ctx.agent) return false;
  const id = evaluate(args[0], ctx) as string;
  return ctx.agent.isPinned(id);
}

// ============================================================================
// LLM (Pure)
// ============================================================================

/**
 * agent/provider - Get current LLM provider name
 */
export function evalAgentProvider(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  if (!ctx.agent) return '';
  return ctx.agent.provider();
}

/**
 * agent/model - Get current LLM model name
 */
export function evalAgentModel(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  if (!ctx.agent) return '';
  return ctx.agent.model();
}

// ============================================================================
// Tools (Pure)
// ============================================================================

/**
 * agent/tools - Get list of available tool names
 */
export function evalAgentTools(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): string[] {
  if (!ctx.agent) return [];
  return ctx.agent.tools();
}

// ============================================================================
// Context (Pure)
// ============================================================================

/**
 * agent/token-count - Get current context window token count
 */
export function evalAgentTokenCount(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  if (!ctx.agent) return 0;
  return ctx.agent.tokenCount();
}

/**
 * agent/context-usage - Get context window usage ratio (0-1)
 */
export function evalAgentContextUsage(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  if (!ctx.agent) return 0;
  return ctx.agent.contextUsage();
}

// ============================================================================
// Session (Pure)
// ============================================================================

/**
 * agent/session-id - Get current session identifier
 */
export function evalAgentSessionId(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  if (!ctx.agent) return '';
  return ctx.agent.sessionId();
}

// ============================================================================
// Memory (Effects)
// ============================================================================

/**
 * agent/memorize - Store a new memory
 */
export function evalAgentMemorize(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const content = evaluate(args[0], ctx) as string;
  const category = evaluate(args[1], ctx) as AgentMemoryCategory;
  const scope = args.length > 2
    ? (evaluate(args[2], ctx) as 'global' | 'project')
    : undefined;
  return ctx.agent.memorize(content, category, scope);
}

/**
 * agent/forget - Remove a memory by id
 */
export function evalAgentForget(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const id = evaluate(args[0], ctx) as string;
  return ctx.agent.forget(id);
}

/**
 * agent/pin - Pin a memory to prevent decay
 */
export function evalAgentPin(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const id = evaluate(args[0], ctx) as string;
  return ctx.agent.pin(id);
}

/**
 * agent/reinforce - Increase a memory's strength
 */
export function evalAgentReinforce(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const id = evaluate(args[0], ctx) as string;
  return ctx.agent.reinforce(id);
}

/**
 * agent/decay - Apply decay to all unpinned memories
 */
export function evalAgentDecay(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  return ctx.agent.decay();
}

// ============================================================================
// LLM (Effects)
// ============================================================================

/**
 * agent/generate - Generate text from the LLM
 */
export function evalAgentGenerate(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const prompt = evaluate(args[0], ctx) as string;
  const options = args.length > 1
    ? (evaluate(args[1], ctx) as AgentGenerateOptions)
    : undefined;
  return ctx.agent.generate(prompt, options);
}

/**
 * agent/switch-provider - Switch LLM provider and optionally model
 */
export function evalAgentSwitchProvider(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const provider = evaluate(args[0], ctx) as string;
  const model = args.length > 1
    ? (evaluate(args[1], ctx) as string)
    : undefined;
  ctx.agent.switchProvider(provider, model);
  return null;
}

// ============================================================================
// Tools (Effects)
// ============================================================================

/**
 * agent/invoke - Invoke a tool by name with arguments
 */
export function evalAgentInvoke(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const toolName = evaluate(args[0], ctx) as string;
  const toolArgs = evaluate(args[1], ctx) as Record<string, unknown>;
  return ctx.agent.invoke(toolName, toolArgs);
}

// ============================================================================
// Context (Effects)
// ============================================================================

/**
 * agent/compact - Compact the context window
 */
export function evalAgentCompact(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const strategy = args.length > 0
    ? (evaluate(args[0], ctx) as AgentCompactStrategy)
    : undefined;
  return ctx.agent.compact(strategy);
}

// ============================================================================
// Session (Effects)
// ============================================================================

/**
 * agent/fork - Fork the current session
 */
export function evalAgentFork(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const label = args.length > 0
    ? (evaluate(args[0], ctx) as string)
    : undefined;
  return ctx.agent.fork(label);
}

/**
 * agent/label - Label the current session checkpoint
 */
export function evalAgentLabel(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const text = evaluate(args[0], ctx) as string;
  ctx.agent.label(text);
  return null;
}

// ============================================================================
// Search (Effects)
// ============================================================================

/**
 * agent/search-code - Search code repositories
 */
export function evalAgentSearchCode(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  if (!ctx.agent) return null;
  const query = evaluate(args[0], ctx) as string;
  const language = args.length > 1
    ? (evaluate(args[1], ctx) as string)
    : undefined;
  return ctx.agent.searchCode(query, language);
}
