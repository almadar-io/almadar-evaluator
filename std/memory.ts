/**
 * Memory Module Runtime Evaluators
 *
 * Runtime implementations for memory/* operators.
 * Pure operators return safe defaults when ctx.memory is undefined.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import type { AgentMemoryRecord } from '@almadar/core';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export function evalMemoryRecall(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): AgentMemoryRecord[] {
  if (!ctx.memory) return [];
  const query = evaluate(args[0], ctx) as string;
  const limit = args.length > 1 ? (evaluate(args[1], ctx) as number) : undefined;
  return ctx.memory.recall(query, limit);
}

export function evalMemoryStore(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<string> | null {
  if (!ctx.memory) return null;
  const content = evaluate(args[0], ctx) as string;
  const category = args.length > 1 ? (evaluate(args[1], ctx) as string) : undefined;
  const strength = args.length > 2 ? (evaluate(args[2], ctx) as number) : undefined;
  return ctx.memory.store(content, category, strength);
}

export function evalMemoryList(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): AgentMemoryRecord[] {
  if (!ctx.memory) return [];
  const category = args.length > 0 ? (evaluate(args[0], ctx) as string) : undefined;
  return ctx.memory.list(category);
}
