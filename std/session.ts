/**
 * Session Module Runtime Evaluators
 *
 * Runtime implementations for session/* operators.
 * Returns null (or [] for array returns) when ctx.session is undefined.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import type { AgentMemoryRecord } from '@almadar/core';
import { isOrbital, isSessionHistoryEntry } from './substrate-guards.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export function evalSessionReadSpec(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  return ctx.session.readSpec(orbitalName);
}

export function evalSessionWriteSpec(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  const spec = evaluate(args[1], ctx);
  if (!isOrbital(spec)) {
    throw new Error(`session/write-spec value for "${orbitalName}" is not a valid orbital definition`);
  }
  return ctx.session.writeSpec(orbitalName, spec);
}

export function evalSessionReadMemory(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<AgentMemoryRecord[]> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  return ctx.session.readMemory(orbitalName);
}

export function evalSessionWriteMemory(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  const memory = evaluate(args[1], ctx) as AgentMemoryRecord[];
  return ctx.session.writeMemory(orbitalName, memory);
}

export function evalSessionReadHistory(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown[]> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  return ctx.session.readHistory(orbitalName);
}

export function evalSessionAppendHistory(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  const entry = evaluate(args[1], ctx);
  if (!isSessionHistoryEntry(entry)) {
    throw new Error(`session/append-history entry for "${orbitalName}" must have role/content/timestamp`);
  }
  return ctx.session.appendHistory(orbitalName, entry);
}

export function evalSessionReadErrors(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<string[]> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  return ctx.session.readErrors(orbitalName);
}

export function evalSessionWriteErrors(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  const errors = evaluate(args[1], ctx) as string[];
  return ctx.session.writeErrors(orbitalName, errors);
}

export function evalSessionReadAnalysis(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.session) return null;
  const orbitalName = evaluate(args[0], ctx) as string;
  return ctx.session.readAnalysis(orbitalName);
}
