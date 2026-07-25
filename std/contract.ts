/**
 * Contract Operators Runtime Evaluators
 *
 * Runtime implementations for contract/* operators — tensor <-> entity
 * conversion and input/output contract validation for the R4 (learned rung)
 * inference seam. Mirrors `contract_helpers.py`
 * (`orbital-rust/crates/orbital-shell-python/src/backend.rs`, generator
 * `generate_contract_helpers`) semantically so the JS runtime path and the
 * emitted Python target agree on the same contract JSON in / JSON out.
 *
 * There is no tensor type on the JS runtime path: a tensor is represented as
 * a plain JSON value — a number, or a (possibly nested) array of numbers —
 * exactly what a `torch.Tensor` round-trips to/from via `tolist()`.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

/** A tensor on the JS path: a number, or nested arrays of numbers. */
export type TensorValue = number | TensorValue[];

/** Per-dimension range bound. Missing bounds default to +-Infinity, matching contract_helpers.py's `float("-inf")`/`float("inf")`. */
export interface ContractRange {
  min?: number;
  max?: number;
}

export interface ContractFieldSpec {
  name: string;
}

export type ContractFieldEntry = string | ContractFieldSpec;

/**
 * Canonical contract shape (matches contract_helpers.py's dict contracts
 * byte-for-byte): `shape`/`ranges` drive validate/clamp/violations, `fields`
 * drives the entity<->tensor mapping. A single contract object may carry
 * both halves.
 */
export interface ContractSpec {
  shape?: number[];
  ranges?: Record<string, ContractRange>;
  fields?: ContractFieldEntry[];
}

export interface ContractViolation {
  type: 'shape_mismatch' | 'range_violation' | 'not_a_tensor';
  expected?: number[];
  actual?: number[];
  dim?: number;
  min?: number;
  max?: number;
  actualMin?: number;
  actualMax?: number;
  /** `not_a_tensor` only — what arrived instead, for diagnosis. */
  actualType?: string;
}

export interface ContractValidationResult {
  valid: boolean;
  violations: ContractViolation[];
}

function fieldName(f: ContractFieldEntry): string {
  return typeof f === 'string' ? f : f.name;
}

/**
 * A JS-path tensor is a number or nested arrays of numbers. Model output
 * arrives from an untrusted service, so every contract operator guards before
 * walking it — an unguarded walk throws a bare `TypeError` three frames deep,
 * which stalls the transition instead of abstaining.
 */
function isTensorValue(v: unknown): v is TensorValue {
  if (typeof v === 'number') return true;
  return Array.isArray(v) && v.every(isTensorValue);
}

/** What arrived instead of a tensor, for the `not_a_tensor` violation. */
function describeType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array containing non-numeric values';
  return typeof v;
}

/** Shape of a tensor value, e.g. `[[1,2],[3,4]]` -> `[2,2]`, `[1,2,3]` -> `[3]`. */
function tensorShape(t: TensorValue): number[] {
  if (typeof t === 'number') return [];
  if (t.length === 0) return [0];
  const first = t[0];
  if (typeof first === 'number') return [t.length];
  return [t.length, ...tensorShape(first)];
}

function lastDimSize(t: TensorValue): number {
  const shape = tensorShape(t);
  return shape.length === 0 ? 0 : shape[shape.length - 1];
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** All values at index `dim` along the last axis, flattened across every leading axis — mirrors `tensor[..., dim]`. */
function gatherLastDim(t: TensorValue, dim: number): number[] {
  if (typeof t === 'number') return [];
  if (t.length === 0) return [];
  if (typeof t[0] === 'number') return [(t as number[])[dim]];
  const out: number[] = [];
  for (const sub of t) out.push(...gatherLastDim(sub, dim));
  return out;
}

/** Replace values at index `dim` along the last axis via `fn` — mirrors in-place `result[..., dim] = ...clamp(...)`. */
function mapLastDim(t: TensorValue, dim: number, fn: (v: number) => number): TensorValue {
  if (typeof t === 'number') return t;
  if (t.length === 0) return t;
  if (typeof t[0] === 'number') {
    const copy = [...(t as number[])];
    copy[dim] = fn(copy[dim]);
    return copy;
  }
  return t.map((sub) => mapLastDim(sub, dim, fn));
}

function validateContract(tensor: unknown, contract: ContractSpec): ContractValidationResult {
  if (!isTensorValue(tensor)) {
    return {
      valid: false,
      violations: [{ type: 'not_a_tensor', actualType: describeType(tensor) }],
    };
  }
  const violations: ContractViolation[] = [];
  const shape = tensorShape(tensor);

  if (contract.shape && !arraysEqual(shape, contract.shape)) {
    violations.push({ type: 'shape_mismatch', expected: contract.shape, actual: shape });
  }

  const ranges = contract.ranges ?? {};
  const size = lastDimSize(tensor);
  for (const [dimStr, bounds] of Object.entries(ranges)) {
    const dim = Number(dimStr);
    if (dim >= size) continue; // out-of-range dim indices are silently skipped, matching contract_validate_input
    const vals = gatherLastDim(tensor, dim);
    const min = bounds.min ?? -Infinity;
    const max = bounds.max ?? Infinity;
    const actualMin = Math.min(...vals);
    const actualMax = Math.max(...vals);
    if (actualMin < min || actualMax > max) {
      violations.push({ type: 'range_violation', dim, min, max, actualMin, actualMax });
    }
  }

  return { valid: violations.length === 0, violations };
}

function clampContract(tensor: unknown, contract: ContractSpec): TensorValue {
  if (!isTensorValue(tensor)) {
    throw new Error(
      `contract/clamp-output: expected a tensor (a number, or nested arrays of numbers), received ${describeType(tensor)}. Validate with contract/validate-output before clamping.`
    );
  }
  const ranges = contract.ranges ?? {};
  const size = lastDimSize(tensor);
  let result = tensor;
  for (const [dimStr, bounds] of Object.entries(ranges)) {
    const dim = Number(dimStr);
    if (dim >= size) continue;
    const min = bounds.min ?? -Infinity;
    const max = bounds.max ?? Infinity;
    result = mapLastDim(result, dim, (v) => Math.min(Math.max(v, min), max));
  }
  return result;
}

/**
 * contract/validate-input - Validate a tensor against an input contract.
 * NOTE: the std/contract.ts metadata declares `returnType: 'boolean'`, but
 * contract_validate_input in contract_helpers.py returns `{valid, violations}` —
 * a metadata/implementation divergence. Implemented to match the Python
 * helper (the thing a future golden-vector harness will diff against).
 */
export function evalContractValidateInput(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): ContractValidationResult {
  const tensor = evaluate(args[0], ctx);
  const contract = evaluate(args[1], ctx) as ContractSpec;
  return validateContract(tensor, contract);
}

/** contract/validate-output - contract_validate_output is a pure alias of contract_validate_input in Python. */
export function evalContractValidateOutput(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): ContractValidationResult {
  return evalContractValidateInput(args, evaluate, ctx);
}

/** contract/clamp-output - Clamp each ranged dimension of the tensor into [min, max]. */
export function evalContractClampOutput(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): TensorValue {
  const tensor = evaluate(args[0], ctx);
  const contract = evaluate(args[1], ctx) as ContractSpec;
  return clampContract(tensor, contract);
}

/** contract/violations - The violations list from validateContract, matching contract_violations. */
export function evalContractViolations(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): ContractViolation[] {
  const tensor = evaluate(args[0], ctx);
  const contract = evaluate(args[1], ctx) as ContractSpec;
  return validateContract(tensor, contract).violations;
}

/**
 * contract/entity-to-tensor - Convert entity fields to a flat tensor via
 * `contract.fields`. Non-numeric field values coerce to 0, matching Python's
 * `float(val) if isinstance(val, (int, float)) else 0.0`.
 */
export function evalContractEntityToTensor(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): TensorValue {
  const entity = evaluate(args[0], ctx) as Record<string, unknown>;
  const contract = evaluate(args[1], ctx) as ContractSpec;
  const fields = contract.fields ?? [];
  return fields.map((f) => {
    const val = entity[fieldName(f)];
    return typeof val === 'number' ? val : 0;
  });
}

/**
 * contract/tensor-to-payload - Convert a tensor back to a `{fieldName: value}`
 * payload via `contract.fields`, matching Python's index-aligned zip.
 */
export function evalContractTensorToPayload(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, TensorValue> {
  const tensor = evaluate(args[0], ctx);
  if (!isTensorValue(tensor)) {
    throw new Error(
      `contract/tensor-to-payload: expected a tensor (a number, or nested arrays of numbers), received ${describeType(tensor)}.`
    );
  }
  const contract = evaluate(args[1], ctx) as ContractSpec;
  const fields = contract.fields ?? [];
  const values: TensorValue[] = Array.isArray(tensor) ? tensor : [tensor];
  const result: Record<string, TensorValue> = {};
  fields.forEach((f, i) => {
    if (i < values.length) result[fieldName(f)] = values[i];
  });
  return result;
}
