/**
 * Contract Operators Runtime Evaluators
 *
 * Runtime implementations for contract/* operators — tensor <-> entity
 * conversion and input/output contract validation for the R4 (learned rung)
 * inference seam. The pure validation core lives in `@almadar/core`
 * (`ml-contract.ts`) so the compiled TypeScript shell imports the SAME
 * implementation this runtime path uses — the two paths cannot drift.
 * Both mirror `contract_helpers.py`
 * (`orbital-rust/crates/orbital-shell-python/src/backend.rs`, generator
 * `generate_contract_helpers`) semantically so the JS runtime path and the
 * emitted Python target agree on the same contract JSON in / JSON out.
 *
 * @packageDocumentation
 */

import {
  contractFieldName,
  describeTensorMismatch,
  isTensorValue,
  mapTensorLastDim,
  tensorLastDimSize,
  validateContract,
} from '@almadar/core';
import type {
  ContractSpec,
  ContractValidationResult,
  ContractViolation,
  TensorValue,
} from '@almadar/core';
import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export type {
  ContractFieldEntry,
  ContractFieldSpec,
  ContractRange,
  ContractSpec,
  ContractValidationResult,
  ContractViolation,
  TensorValue,
} from '@almadar/core';

function clampContract(tensor: unknown, contract: ContractSpec): TensorValue {
  if (!isTensorValue(tensor)) {
    throw new Error(
      `contract/clamp-output: expected a tensor (a number, or nested arrays of numbers), received ${describeTensorMismatch(tensor)}. Validate with contract/validate-output before clamping.`
    );
  }
  const ranges = contract.ranges ?? {};
  const size = tensorLastDimSize(tensor);
  let result = tensor;
  for (const [dimStr, bounds] of Object.entries(ranges)) {
    const dim = Number(dimStr);
    if (dim >= size) continue;
    const min = bounds.min ?? -Infinity;
    const max = bounds.max ?? Infinity;
    result = mapTensorLastDim(result, dim, (v) => Math.min(Math.max(v, min), max));
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
    const val = entity[contractFieldName(f)];
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
      `contract/tensor-to-payload: expected a tensor (a number, or nested arrays of numbers), received ${describeTensorMismatch(tensor)}.`
    );
  }
  const contract = evaluate(args[1], ctx) as ContractSpec;
  const fields = contract.fields ?? [];
  const values: TensorValue[] = Array.isArray(tensor) ? tensor : [tensor];
  const result: Record<string, TensorValue> = {};
  fields.forEach((f, i) => {
    if (i < values.length) result[contractFieldName(f)] = values[i];
  });
  return result;
}
