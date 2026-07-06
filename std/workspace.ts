/**
 * Workspace Module Runtime Evaluators
 *
 * Runtime implementations for workspace/* operators.
 * Returns null when ctx.workspace is undefined.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export function evalWorkspaceReadOrbital(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.workspace) return null;
  const name = evaluate(args[0], ctx) as string;
  return ctx.workspace.readOrbital(name);
}

export function evalWorkspaceWriteOrbital(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.workspace) return null;
  const name = evaluate(args[0], ctx) as string;
  const content = evaluate(args[1], ctx);
  return ctx.workspace.writeOrbital(name, content);
}

export function evalWorkspaceReadFile(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<string> | null {
  if (!ctx.workspace) return null;
  const path = evaluate(args[0], ctx) as string;
  return ctx.workspace.readFile(path);
}

export function evalWorkspaceWriteFile(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.workspace) return null;
  const path = evaluate(args[0], ctx) as string;
  const content = evaluate(args[1], ctx) as string;
  return ctx.workspace.writeFile(path, content);
}

export function evalWorkspaceExists(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): boolean {
  if (!ctx.workspace) return false;
  const path = evaluate(args[0], ctx) as string;
  return ctx.workspace.exists(path);
}

export function evalWorkspaceListOrbitals(_args: SExpr[], _evaluate: EvalFn, ctx: EvaluationContext): string[] {
  if (!ctx.workspace) return [];
  return ctx.workspace.listOrbitals();
}

export function evalWorkspaceReadSchema(_args: SExpr[], _evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.workspace) return null;
  return ctx.workspace.readSchema();
}

export function evalWorkspaceWriteSchema(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.workspace) return null;
  const schema = evaluate(args[0], ctx);
  return ctx.workspace.writeSchema(schema);
}

export function evalWorkspaceReadPlan(_args: SExpr[], _evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.workspace) return null;
  return ctx.workspace.readPlan();
}

export function evalWorkspaceWritePlan(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.workspace) return null;
  const plan = evaluate(args[0], ctx);
  return ctx.workspace.writePlan(plan);
}

export function evalWorkspaceArchiveOrbital(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<void> | null {
  if (!ctx.workspace) return null;
  const name = evaluate(args[0], ctx) as string;
  return ctx.workspace.archiveOrbital(name);
}
