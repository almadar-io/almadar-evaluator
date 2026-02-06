/**
 * S-Expression Types
 *
 * Re-exports S-expression types from the canonical @almadar/core package.
 * This ensures almadar-evaluator stays in sync with the single source of truth.
 *
 * @packageDocumentation
 */

// Re-export all S-expression types from @almadar/core
export {
  // Types
  type SExpr,
  type SExprAtom,
  type Expression,
  type ParsedBinding,
  type CoreBinding,
  type SExprInput,
  type ExpressionInput,

  // Schemas
  SExprSchema,
  SExprAtomSchema,
  ExpressionSchema,

  // Type guards
  isSExpr,
  isSExprAtom,
  isBinding,
  isSExprCall,
  isValidBinding,

  // Utilities
  parseBinding,
  getOperator,
  getArgs,
  sexpr,
  walkSExpr,
  collectBindings,

  // Constants
  CORE_BINDINGS,
} from '@almadar/core';
