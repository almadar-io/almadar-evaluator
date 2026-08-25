/**
 * S-Expression Evaluator
 *
 * Runtime interpreter for S-expressions.
 * Used for evaluating guards and executing effects in the preview system.
 *
 * @packageDocumentation
 */

import type { SExpr } from './types/expression.js';
import { assertOperatorArity } from '@almadar/std/registry';
import { isSExpr, isBinding, getOperator, getArgs } from './types/expression.js';
import type { EvaluationContext, Evaluator } from './context.js';
import type { RuntimeValue } from '@almadar/core';
import { resolveBinding } from './context.js';

// Import operators
import {
  evalAdd,
  evalSubtract,
  evalMultiply,
  evalDivide,
  evalModulo,
  evalAbs,
  evalMin,
  evalMax,
  evalFloor,
  evalCeil,
  evalRound,
  evalClamp,
  evalEqual,
  evalNotEqual,
  evalLessThan,
  evalGreaterThan,
  evalLessThanOrEqual,
  evalGreaterThanOrEqual,
  evalMatches,
  evalAnd,
  evalOr,
  evalNot,
  evalIf,
  evalLet,
  evalDo,
  evalWhen,
  evalFn,
  evalMap,
  evalFilter,
  evalFind,
  evalCount,
  evalSum,
  evalFirst,
  evalLast,
  evalNth,
  evalConcat,
  evalIncludes,
  evalEmpty,
  evalList,
  evalSet,
  evalSetDynamic,
  evalIncrement,
  evalDecrement,
  evalEmit,
  evalPersist,
  evalNavigate,
  evalNotify,
  evalSpawn,
  evalDespawn,
  evalCallService,
  evalRenderUI,
  evalRef,
  evalDeref,
  evalSwap,
  evalWatch,
  evalAtomic,
} from './operators/index.js';

// Import std library evaluators
import * as stdMath from './std/math.js';
import * as stdStr from './std/str.js';
import * as stdArray from './std/array.js';
import * as stdObject from './std/object.js';
import * as stdValidate from './std/validate.js';
import * as stdTime from './std/time.js';
import * as stdFormat from './std/format.js';
import * as stdAsync from './std/async.js';
import * as stdProb from './std/prob.js';
import * as stdOs from './std/os.js';
import * as stdContract from './std/contract.js';
import * as stdGraph from './std/graph.js';
import * as stdData from './std/data.js';
import * as stdLlm from './std/llm.js';
import * as stdWorkspace from './std/workspace.js';
import * as stdSession from './std/session.js';
import * as stdMemory from './std/memory.js';
import * as stdTrace from './std/trace.js';
import * as stdIntegration from './std/integration.js';
import * as stdVec from './std/vector.js';
import * as stdGeo from './std/geo.js';
import * as stdGrid from './std/grid.js';
import * as stdAnim from './std/anim.js';
import * as stdEase from './std/ease.js';
import * as stdNoise from './std/noise.js';
import * as stdPath from './std/path.js';

/**
 * A compiled S-expression node: the operator impl and child closures are
 * resolved once at compile time, so a firing pays zero dispatch, zero arity
 * checks, and zero binding-path parsing.
 */
type CompiledFn = (ctx: EvaluationContext) => RuntimeValue;

/**
 * One operator implementation — the shared contract every `evalX` satisfies,
 * including lazy forms (`if`/`let`/`fn` decide when to call `evaluate`).
 */
type OpImpl = (args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext) => RuntimeValue;

/**
 * Sentinel returned by dispatchOperator when the head is not a registered
 * operator — the caller then treats the array as literal data.
 */
const UNKNOWN_OPERATOR = Symbol('unknown-operator');

/**
 * S-Expression Evaluator class.
 *
 * Provides runtime interpretation of S-expressions for guards, effects, and computed values.
 */
/**
 * The one op -> implementation mapping, shared by the interpreter's
 * dispatchOperator and the tier-up compiler (arity is asserted by the
 * caller: per dispatch when interpreting, once at compile time when compiled).
 */
const OPERATOR_TABLE: Record<string, OpImpl> = {
  '+': evalAdd,
  '-': evalSubtract,
  '*': evalMultiply,
  '/': evalDivide,
  '%': evalModulo,
  'abs': evalAbs,
  'min': evalMin,
  'max': evalMax,
  'floor': evalFloor,
  'ceil': evalCeil,
  'round': evalRound,
  'clamp': evalClamp,
  '=': evalEqual,
  '==': evalEqual,
  '!=': evalNotEqual,
  '<': evalLessThan,
  '>': evalGreaterThan,
  '<=': evalLessThanOrEqual,
  '>=': evalGreaterThanOrEqual,
  'matches': evalMatches,
  'and': evalAnd,
  'or': evalOr,
  'not': evalNot,
  'if': evalIf,
  'let': evalLet,
  'do': evalDo,
  'when': evalWhen,
  'fn': evalFn,
  'lambda': evalFn,
  'map': evalMap,
  'filter': evalFilter,
  'find': evalFind,
  'count': evalCount,
  'sum': evalSum,
  'first': evalFirst,
  'last': evalLast,
  'nth': evalNth,
  'concat': evalConcat,
  'includes': evalIncludes,
  'empty': evalEmpty,
  'list': evalList,
  'set': (args, evaluate, ctx) => { evalSet(args, evaluate, ctx); return undefined; },
  'set-dynamic': (args, evaluate, ctx) => { evalSetDynamic(args, evaluate, ctx); return undefined; },
  'increment': (args, evaluate, ctx) => { evalIncrement(args, evaluate, ctx); return undefined; },
  'decrement': (args, evaluate, ctx) => { evalDecrement(args, evaluate, ctx); return undefined; },
  'emit': (args, evaluate, ctx) => { evalEmit(args, evaluate, ctx); return undefined; },
  'persist': (args, evaluate, ctx) => { evalPersist(args, evaluate, ctx); return undefined; },
  'navigate': (args, evaluate, ctx) => { evalNavigate(args, evaluate, ctx); return undefined; },
  'notify': (args, evaluate, ctx) => { evalNotify(args, evaluate, ctx); return undefined; },
  'spawn': (args, evaluate, ctx) => { evalSpawn(args, evaluate, ctx); return undefined; },
  'despawn': (args, evaluate, ctx) => { evalDespawn(args, evaluate, ctx); return undefined; },
  'call-service': (args, evaluate, ctx) => { evalCallService(args, evaluate, ctx); return undefined; },
  'render-ui': (args, evaluate, ctx) => { evalRenderUI(args, evaluate, ctx); return undefined; },
  'ref': evalRef,
  'deref': evalDeref,
  'swap!': evalSwap,
  'watch': (args, evaluate, ctx) => { evalWatch(args, evaluate, ctx); return undefined; },
  'atomic': evalAtomic,
  'math/abs': stdMath.evalMathAbs,
  'math/min': stdMath.evalMathMin,
  'math/max': stdMath.evalMathMax,
  'math/clamp': stdMath.evalMathClamp,
  'math/floor': stdMath.evalMathFloor,
  'math/ceil': stdMath.evalMathCeil,
  'math/round': stdMath.evalMathRound,
  'math/pow': stdMath.evalMathPow,
  'math/sqrt': stdMath.evalMathSqrt,
  'math/mod': stdMath.evalMathMod,
  'math/sign': stdMath.evalMathSign,
  'math/lerp': stdMath.evalMathLerp,
  'math/map': stdMath.evalMathMap,
  'math/random': () => stdMath.evalMathRandom(),
  'math/randomInt': stdMath.evalMathRandomInt,
  'math/default': stdMath.evalMathDefault,
  'math/sin': stdMath.evalMathSin,
  'math/cos': stdMath.evalMathCos,
  'math/tan': stdMath.evalMathTan,
  'math/atan2': stdMath.evalMathAtan2,
  'math/asin': stdMath.evalMathAsin,
  'math/acos': stdMath.evalMathAcos,
  'math/atan': stdMath.evalMathAtan,
  'math/hypot': stdMath.evalMathHypot,
  'math/deg-rad': stdMath.evalMathDegRad,
  'math/rad-deg': stdMath.evalMathRadDeg,
  'math/wrap': stdMath.evalMathWrap,
  'math/approach': stdMath.evalMathApproach,
  'vec/add': stdVec.evalVecAdd,
  'vec/sub': stdVec.evalVecSub,
  'vec/scale': stdVec.evalVecScale,
  'vec/dot': stdVec.evalVecDot,
  'vec/cross': stdVec.evalVecCross,
  'vec/length': stdVec.evalVecLength,
  'vec/length-sq': stdVec.evalVecLengthSq,
  'vec/normalize': stdVec.evalVecNormalize,
  'vec/distance': stdVec.evalVecDistance,
  'vec/distance-sq': stdVec.evalVecDistanceSq,
  'vec/lerp': stdVec.evalVecLerp,
  'vec/angle': stdVec.evalVecAngle,
  'vec/rotate': stdVec.evalVecRotate,
  'vec/clamp-length': stdVec.evalVecClampLength,
  'geo/aabb-overlap': stdGeo.evalGeoAabbOverlap,
  'geo/circle-overlap': stdGeo.evalGeoCircleOverlap,
  'geo/rect-circle-overlap': stdGeo.evalGeoRectCircleOverlap,
  'geo/point-in-rect': stdGeo.evalGeoPointInRect,
  'geo/point-in-circle': stdGeo.evalGeoPointInCircle,
  'geo/reflect': stdGeo.evalGeoReflect,
  'geo/segment-intersect': stdGeo.evalGeoSegmentIntersect,
  'grid/to-world': stdGrid.evalGridToWorld,
  'grid/from-world': stdGrid.evalGridFromWorld,
  'grid/iso-to-screen': stdGrid.evalGridIsoToScreen,
  'grid/screen-to-iso': stdGrid.evalGridScreenToIso,
  'grid/distance': stdGrid.evalGridDistance,
  'grid/manhattan-distance': stdGrid.evalGridManhattanDistance,
  'grid/neighbors': stdGrid.evalGridNeighbors,
  'grid/cells-in-radius': stdGrid.evalGridCellsInRadius,
  'grid/line': stdGrid.evalGridLine,
  'grid/in-bounds': stdGrid.evalGridInBounds,
  'anim/frame-at': stdAnim.evalAnimFrameAt,
  'anim/sheet-rect': stdAnim.evalAnimSheetRect,
  'anim/direction-from-delta': stdAnim.evalAnimDirectionFromDelta,
  'ease/apply': stdEase.evalEaseApply,
  'ease/smoothstep': stdEase.evalEaseSmoothstep,
  'noise/perlin': stdNoise.evalNoisePerlin,
  'noise/simplex': stdNoise.evalNoiseSimplex,
  'noise/fbm': stdNoise.evalNoiseFbm,
  'path/astar': stdPath.evalPathAstar,
  'path/reachable': stdPath.evalPathReachable,
  'str/len': stdStr.evalStrLen,
  'str/concat': stdStr.evalStrConcat,
  'str/upper': stdStr.evalStrUpper,
  'str/lower': stdStr.evalStrLower,
  'str/trim': stdStr.evalStrTrim,
  'str/trimStart': stdStr.evalStrTrimStart,
  'str/trimEnd': stdStr.evalStrTrimEnd,
  'str/split': stdStr.evalStrSplit,
  'str/join': stdStr.evalStrJoin,
  'str/slice': stdStr.evalStrSlice,
  'str/replace': stdStr.evalStrReplace,
  'str/replaceAll': stdStr.evalStrReplaceAll,
  'str/includes': stdStr.evalStrIncludes,
  'str/startsWith': stdStr.evalStrStartsWith,
  'str/endsWith': stdStr.evalStrEndsWith,
  'str/padStart': stdStr.evalStrPadStart,
  'str/padEnd': stdStr.evalStrPadEnd,
  'str/repeat': stdStr.evalStrRepeat,
  'str/reverse': stdStr.evalStrReverse,
  'str/capitalize': stdStr.evalStrCapitalize,
  'str/titleCase': stdStr.evalStrTitleCase,
  'str/camelCase': stdStr.evalStrCamelCase,
  'str/kebabCase': stdStr.evalStrKebabCase,
  'str/snakeCase': stdStr.evalStrSnakeCase,
  'str/default': stdStr.evalStrDefault,
  'str/template': stdStr.evalStrTemplate,
  'str/truncate': stdStr.evalStrTruncate,
  'to-string': (args, evaluate, ctx) => String(evaluate(args[0], ctx)),
  'array/len': stdArray.evalArrayLen,
  'array/range': stdArray.evalArrayRange,
  'array/empty?': stdArray.evalArrayEmpty,
  'array/first': stdArray.evalArrayFirst,
  'array/last': stdArray.evalArrayLast,
  'array/nth': stdArray.evalArrayNth,
  'array/slice': stdArray.evalArraySlice,
  'array/concat': stdArray.evalArrayConcat,
  'array/append': stdArray.evalArrayAppend,
  'array/prepend': stdArray.evalArrayPrepend,
  'array/insert': stdArray.evalArrayInsert,
  'array/remove': stdArray.evalArrayRemove,
  'array/removeItem': stdArray.evalArrayRemoveItem,
  'array/reverse': stdArray.evalArrayReverse,
  'array/sort': stdArray.evalArraySort,
  'array/shuffle': stdArray.evalArrayShuffle,
  'array/unique': stdArray.evalArrayUnique,
  'array/flatten': stdArray.evalArrayFlatten,
  'array/zip': stdArray.evalArrayZip,
  'array/includes': stdArray.evalArrayIncludes,
  'array/indexOf': stdArray.evalArrayIndexOf,
  'array/find': stdArray.evalArrayFind,
  'array/findIndex': stdArray.evalArrayFindIndex,
  'array/filter': stdArray.evalArrayFilter,
  'array/reject': stdArray.evalArrayReject,
  'array/map': stdArray.evalArrayMap,
  'array/reduce': stdArray.evalArrayReduce,
  'array/every': stdArray.evalArrayEvery,
  'array/some': stdArray.evalArraySome,
  'array/count': stdArray.evalArrayCount,
  'array/sum': stdArray.evalArraySum,
  'array/avg': stdArray.evalArrayAvg,
  'array/min': stdArray.evalArrayMin,
  'array/max': stdArray.evalArrayMax,
  'array/groupBy': stdArray.evalArrayGroupBy,
  'array/partition': stdArray.evalArrayPartition,
  'array/take': stdArray.evalArrayTake,
  'array/drop': stdArray.evalArrayDrop,
  'array/takeLast': stdArray.evalArrayTakeLast,
  'array/dropLast': stdArray.evalArrayDropLast,
  'array/cosine': stdArray.evalArrayCosine,
  'array/nearest': stdArray.evalArrayNearest,
  'object/keys': stdObject.evalObjectKeys,
  'object/values': stdObject.evalObjectValues,
  'object/entries': stdObject.evalObjectEntries,
  'object/fromEntries': stdObject.evalObjectFromEntries,
  'object/get': stdObject.evalObjectGet,
  'object/set': stdObject.evalObjectSet,
  'object/has': stdObject.evalObjectHas,
  'object/merge': stdObject.evalObjectMerge,
  'object/deepMerge': stdObject.evalObjectDeepMerge,
  'object/pick': stdObject.evalObjectPick,
  'object/omit': stdObject.evalObjectOmit,
  'object/mapValues': stdObject.evalObjectMapValues,
  'object/mapKeys': stdObject.evalObjectMapKeys,
  'object/filter': stdObject.evalObjectFilter,
  'object/empty?': stdObject.evalObjectEmpty,
  'object/equals': stdObject.evalObjectEquals,
  'object/clone': stdObject.evalObjectClone,
  'object/deepClone': stdObject.evalObjectDeepClone,
  'path': stdObject.evalPath,
  'validate/required': stdValidate.evalValidateRequired,
  'validate/string': stdValidate.evalValidateString,
  'validate/number': stdValidate.evalValidateNumber,
  'validate/boolean': stdValidate.evalValidateBoolean,
  'validate/array': stdValidate.evalValidateArray,
  'validate/object': stdValidate.evalValidateObject,
  'validate/email': stdValidate.evalValidateEmail,
  'validate/url': stdValidate.evalValidateUrl,
  'validate/uuid': stdValidate.evalValidateUuid,
  'validate/phone': stdValidate.evalValidatePhone,
  'validate/creditCard': stdValidate.evalValidateCreditCard,
  'validate/date': stdValidate.evalValidateDate,
  'validate/minLength': stdValidate.evalValidateMinLength,
  'validate/maxLength': stdValidate.evalValidateMaxLength,
  'validate/length': stdValidate.evalValidateLength,
  'validate/min': stdValidate.evalValidateMin,
  'validate/max': stdValidate.evalValidateMax,
  'validate/range': stdValidate.evalValidateRange,
  'validate/pattern': stdValidate.evalValidatePattern,
  'validate/oneOf': stdValidate.evalValidateOneOf,
  'validate/noneOf': stdValidate.evalValidateNoneOf,
  'validate/equals': stdValidate.evalValidateEquals,
  'validate/check': stdValidate.evalValidateCheck,
  'time/now': () => stdTime.evalTimeNow(),
  'time/today': () => stdTime.evalTimeToday(),
  'time/parse': stdTime.evalTimeParse,
  'time/format': stdTime.evalTimeFormat,
  'time/year': stdTime.evalTimeYear,
  'time/month': stdTime.evalTimeMonth,
  'time/day': stdTime.evalTimeDay,
  'time/weekday': stdTime.evalTimeWeekday,
  'time/hour': stdTime.evalTimeHour,
  'time/minute': stdTime.evalTimeMinute,
  'time/second': stdTime.evalTimeSecond,
  'time/add': stdTime.evalTimeAdd,
  'time/subtract': stdTime.evalTimeSubtract,
  'time/diff': stdTime.evalTimeDiff,
  'time/startOf': stdTime.evalTimeStartOf,
  'time/endOf': stdTime.evalTimeEndOf,
  'time/isBefore': stdTime.evalTimeIsBefore,
  'time/isAfter': stdTime.evalTimeIsAfter,
  'time/isBetween': stdTime.evalTimeIsBetween,
  'time/isSame': stdTime.evalTimeIsSame,
  'time/isPast': stdTime.evalTimeIsPast,
  'time/isFuture': stdTime.evalTimeIsFuture,
  'time/isToday': stdTime.evalTimeIsToday,
  'time/relative': stdTime.evalTimeRelative,
  'time/duration': stdTime.evalTimeDuration,
  'format/number': stdFormat.evalFormatNumber,
  'format/currency': stdFormat.evalFormatCurrency,
  'format/percent': stdFormat.evalFormatPercent,
  'format/bytes': stdFormat.evalFormatBytes,
  'format/ordinal': stdFormat.evalFormatOrdinal,
  'format/plural': stdFormat.evalFormatPlural,
  'format/list': stdFormat.evalFormatList,
  'format/phone': stdFormat.evalFormatPhone,
  'format/creditCard': stdFormat.evalFormatCreditCard,
  'async/delay': stdAsync.evalAsyncDelay,
  'async/interval': stdAsync.evalAsyncInterval,
  'async/timeout': stdAsync.evalAsyncTimeout,
  'async/debounce': (args, evaluate, ctx) => { stdAsync.evalAsyncDebounce(args, evaluate, ctx); return undefined; },
  'async/throttle': (args, evaluate, ctx) => { stdAsync.evalAsyncThrottle(args, evaluate, ctx); return undefined; },
  'async/retry': stdAsync.evalAsyncRetry,
  'async/race': stdAsync.evalAsyncRace,
  'async/all': stdAsync.evalAsyncAll,
  'async/sequence': stdAsync.evalAsyncSequence,
  'prob/seed': (args, evaluate, ctx) => { stdProb.evalProbSeed(args, evaluate, ctx); return undefined; },
  'prob/flip': stdProb.evalProbFlip,
  'prob/gaussian': stdProb.evalProbGaussian,
  'prob/uniform': stdProb.evalProbUniform,
  'prob/beta': stdProb.evalProbBeta,
  'prob/categorical': stdProb.evalProbCategorical,
  'prob/poisson': stdProb.evalProbPoisson,
  'prob/condition': (args, evaluate, ctx) => { stdProb.evalProbCondition(args, evaluate, ctx); return undefined; },
  'prob/sample': stdProb.evalProbSample,
  'prob/posterior': stdProb.evalProbPosterior,
  'prob/infer': stdProb.evalProbInfer,
  'prob/expected-value': stdProb.evalProbExpectedValue,
  'prob/variance': stdProb.evalProbVariance,
  'prob/histogram': stdProb.evalProbHistogram,
  'prob/percentile': stdProb.evalProbPercentile,
  'prob/credible-interval': stdProb.evalProbCredibleInterval,
  'os/watch-files': (args, evaluate, ctx) => { stdOs.evalOsWatchFiles(args, evaluate, ctx); return undefined; },
  'os/watch-process': (args, evaluate, ctx) => { stdOs.evalOsWatchProcess(args, evaluate, ctx); return undefined; },
  'os/watch-port': (args, evaluate, ctx) => { stdOs.evalOsWatchPort(args, evaluate, ctx); return undefined; },
  'os/watch-http': (args, evaluate, ctx) => { stdOs.evalOsWatchHttp(args, evaluate, ctx); return undefined; },
  'os/watch-cron': (args, evaluate, ctx) => { stdOs.evalOsWatchCron(args, evaluate, ctx); return undefined; },
  'os/watch-signal': (args, evaluate, ctx) => { stdOs.evalOsWatchSignal(args, evaluate, ctx); return undefined; },
  'os/watch-env': (args, evaluate, ctx) => { stdOs.evalOsWatchEnv(args, evaluate, ctx); return undefined; },
  'os/debounce': (args, evaluate, ctx) => { stdOs.evalOsDebounce(args, evaluate, ctx); return undefined; },
  'llm/generate': stdLlm.evalLlmGenerate,
  'llm/call-tools': stdLlm.evalLlmCallTools,
  'llm/embed': stdLlm.evalLlmEmbed,
  'llm/token-count': stdLlm.evalLlmTokenCount,
  'llm/switch': stdLlm.evalLlmSwitch,
  'llm/compact': stdLlm.evalLlmCompact,
  'workspace/read-orbital': stdWorkspace.evalWorkspaceReadOrbital,
  'workspace/write-orbital': stdWorkspace.evalWorkspaceWriteOrbital,
  'workspace/read-file': stdWorkspace.evalWorkspaceReadFile,
  'workspace/write-file': stdWorkspace.evalWorkspaceWriteFile,
  'workspace/exists': stdWorkspace.evalWorkspaceExists,
  'workspace/list-orbitals': stdWorkspace.evalWorkspaceListOrbitals,
  'workspace/read-schema': stdWorkspace.evalWorkspaceReadSchema,
  'workspace/write-schema': stdWorkspace.evalWorkspaceWriteSchema,
  'workspace/read-plan': stdWorkspace.evalWorkspaceReadPlan,
  'workspace/write-plan': stdWorkspace.evalWorkspaceWritePlan,
  'workspace/archive-orbital': stdWorkspace.evalWorkspaceArchiveOrbital,
  'session/read-spec': stdSession.evalSessionReadSpec,
  'session/write-spec': stdSession.evalSessionWriteSpec,
  'session/read-memory': stdSession.evalSessionReadMemory,
  'session/write-memory': stdSession.evalSessionWriteMemory,
  'session/read-history': stdSession.evalSessionReadHistory,
  'session/append-history': stdSession.evalSessionAppendHistory,
  'session/read-errors': stdSession.evalSessionReadErrors,
  'session/write-errors': stdSession.evalSessionWriteErrors,
  'session/read-analysis': stdSession.evalSessionReadAnalysis,
  'memory/recall': stdMemory.evalMemoryRecall,
  'memory/store': stdMemory.evalMemoryStore,
  'memory/list': stdMemory.evalMemoryList,
  'trace/emit': stdTrace.evalTraceEmit,
  'trace/log': stdTrace.evalTraceLog,
  'integration/http': stdIntegration.evalIntegrationHttp,
  'integration/github-get-repo': stdIntegration.evalIntegrationGithubGetRepo,
  'integration/github-create-issue': stdIntegration.evalIntegrationGithubCreateIssue,
  'contract/validate-input': stdContract.evalContractValidateInput,
  'contract/validate-output': stdContract.evalContractValidateOutput,
  'contract/clamp-output': stdContract.evalContractClampOutput,
  'contract/violations': stdContract.evalContractViolations,
  'contract/entity-to-tensor': stdContract.evalContractEntityToTensor,
  'contract/tensor-to-payload': stdContract.evalContractTensorToPayload,
  'graph/from-entities': stdGraph.evalGraphFromEntities,
  'graph/from-adjacency': stdGraph.evalGraphFromAdjacency,
  'graph/from-edge-list': stdGraph.evalGraphFromEdgeList,
  'graph/add-self-loops': stdGraph.evalGraphAddSelfLoops,
  'graph/to-undirected': stdGraph.evalGraphToUndirected,
  'graph/subgraph': stdGraph.evalGraphSubgraph,
  'graph/k-hop': stdGraph.evalGraphKHop,
  'graph/node-features': stdGraph.evalGraphNodeFeatures,
  'graph/edge-index': stdGraph.evalGraphEdgeIndex,
  'graph/edge-features': stdGraph.evalGraphEdgeFeatures,
  'graph/num-nodes': stdGraph.evalGraphNumNodes,
  'graph/num-edges': stdGraph.evalGraphNumEdges,
  'graph/degree': stdGraph.evalGraphDegree,
  'graph/batch': stdGraph.evalGraphBatch,
  'data/dataset': stdData.evalDataDataset,
  'data/dataloader': stdData.evalDataDataloader,
  'data/split': stdData.evalDataSplit,
  'data/normalize': stdData.evalDataNormalize,
  'data/augment': stdData.evalDataAugment,
  'data/tokenize': stdData.evalDataTokenize,
  'data/pad': stdData.evalDataPad,
};

export class SExpressionEvaluator {
  /**
   * Tier-up compilation cache, keyed by node IDENTITY: schema trees are
   * long-lived parsed objects, so a WeakMap costs no key serialization and
   * is collected with the schema. First sight of a node interprets it and
   * marks it seen; the second sight compiles it — one-off dynamically built
   * expressions never pay compile cost.
   */
  private compileCache = new WeakMap<object, true | CompiledFn>();

  /** Single bound interpreter handed to operator impls — was allocated per dispatch. */
  private readonly boundInterpret: Evaluator = (expr, c) => this.interpret(expr, c);

  /**
   * Evaluate an S-expression in the given context.
   * Hot trees promote to compiled closures on second use; everything else
   * runs through the interpreter.
   *
   * @param expr - S-expression to evaluate
   * @param ctx - Evaluation context with bindings and effect handlers
   * @returns Result of evaluation
   */
  evaluate(expr: SExpr, ctx: EvaluationContext): RuntimeValue {
    if (typeof expr === 'object' && expr !== null) {
      const entry = this.compileCache.get(expr);
      if (typeof entry === 'function') return entry(ctx);
      if (entry === true) {
        const fn = this.compileNode(expr, new Map(), undefined);
        this.compileCache.set(expr, fn);
        return fn(ctx);
      }
      this.compileCache.set(expr, true);
    }
    return this.interpret(expr, ctx);
  }

  /**
   * The tree-walking interpreter of record — first-use path and the
   * compiler's fallback for foreign subtrees.
   */
  private interpret(expr: SExpr, ctx: EvaluationContext): RuntimeValue {
    // Atom: literal value
    if (!isSExpr(expr)) {
      // Check if it's a binding
      if (isBinding(expr)) {
        return resolveBinding(expr, ctx);
      }
      // Plain object literal — recursively evaluate each property so that
      // SExpression values inside `{ key: (op ...), ... }` get reduced to
      // their concrete results. This is the canonical lambda-body shape
      // for `array/map` returning records (e.g. std-stats's metric→card
      // lambda whose body is `{ label: (object/get ...), value: (if ...) }`).
      // Without this, the evaluator returns the raw SExpression and the
      // UI renders the lolo source as text.
      if (this.isPlainObject(expr)) {
        const out: Record<string, RuntimeValue> = {};
        for (const [k, v] of Object.entries(expr as Record<string, RuntimeValue>)) {
          out[k] = this.evaluate(v as SExpr, ctx);
        }
        return out;
      }
      // Literal array (non-call — first element is not a string operator):
      // evaluate each element so SExpressions nested inside `[ {…}, … ]`
      // reduce to concrete values. Parity with orbital-core `eval_expr`
      // ("Literal array - evaluate all elements"); without it, values
      // fetched later via `object/get` out of a concatenated literal row
      // surface as raw lolo source (e.g. a unit's position/asset reaching
      // the canvas as unevaluated expressions).
      if (Array.isArray(expr)) {
        return expr.map((item) => this.evaluate(item as SExpr, ctx));
      }
      // Return literal value
      return expr;
    }

    // S-expression call
    const op = getOperator(expr)!;
    const args = getArgs(expr);

    // Dispatch to operator implementation. An unregistered head means the
    // array is DATA, not a call form (e.g. `animations: ["static"]` inlined
    // from an asset manifest): reduce its elements verbatim instead of
    // warning "Unknown operator" per evaluation (~17k/s on large grids) and
    // dropping the array from the evaluated copy.
    const result = this.dispatchOperator(op, args, ctx);
    if (result === UNKNOWN_OPERATOR) {
      return expr.map((item) => this.evaluate(item as SExpr, ctx));
    }
    return result;
  }

  /**
   * Compile one tree into composed closures. Every node of the tree is
   * registered in `into` so the impls' `evaluate` callback (childDispatch)
   * resolves in-tree children by identity and falls back to interpretation
   * only for foreign subtrees. Arity is asserted HERE, once — a tree that
   * compiles never re-validates.
   */
  private compileNode(expr: SExpr, into: Map<SExpr, CompiledFn>, childDispatch: Evaluator | undefined): CompiledFn {
    const dispatch: Evaluator = childDispatch ?? ((e, c) => {
      const f = into.get(e);
      return f !== undefined ? f(c) : this.interpret(e, c);
    });

    let fn: CompiledFn;
    if (!isSExpr(expr)) {
      if (isBinding(expr)) {
        fn = (ctx) => resolveBinding(expr, ctx);
      } else if (this.isPlainObject(expr)) {
        const entries = Object.entries(expr as Record<string, SExpr>).map(
          ([k, v]) => [k, this.compileNode(v, into, dispatch)] as const,
        );
        fn = (ctx) => {
          const out: Record<string, RuntimeValue> = {};
          for (const [k, f] of entries) out[k] = f(ctx);
          return out;
        };
      } else if (Array.isArray(expr)) {
        const items = expr.map((item) => this.compileNode(item as SExpr, into, dispatch));
        fn = (ctx) => items.map((f) => f(ctx));
      } else {
        fn = () => expr;
      }
    } else {
      const op = getOperator(expr)!;
      const args = getArgs(expr);
      // Arity before the table lookup — same order as dispatchOperator, so a
      // registry-registered but undispatched head throws identically on both
      // paths (assertOperatorArity no-ops on unregistered ops).
      assertOperatorArity(op, args.length);
      const impl = OPERATOR_TABLE[op];
      // Children are compiled either way: the data-array fallback reduces
      // the whole array (operator head included — a constant string).
      for (const item of expr) {
        if (!into.has(item as SExpr)) this.compileNode(item as SExpr, into, dispatch);
      }
      if (impl === undefined) {
        fn = (ctx) => (expr as SExpr[]).map((item) => {
          const f = into.get(item as SExpr);
          return f !== undefined ? f(ctx) : this.interpret(item as SExpr, ctx);
        });
      } else {
        fn = (ctx) => impl(args, dispatch, ctx);
      }
    }
    into.set(expr, fn);
    return fn;
  }

  private isPlainObject(value: RuntimeValue): value is Record<string, RuntimeValue> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  /**
   * Evaluate an S-expression as a guard (returns boolean).
   *
   * @param expr - S-expression guard
   * @param ctx - Evaluation context
   * @returns true if guard passes, false otherwise
   */
  evaluateGuard(expr: SExpr, ctx: EvaluationContext): boolean {
    const result = this.evaluate(expr, ctx);
    return Boolean(result);
  }

  /**
   * Execute an effect S-expression.
   *
   * @param expr - Effect S-expression (e.g., ["set", "@entity.x", 10])
   * @param ctx - Evaluation context with effect handlers
   */
  executeEffect(expr: SExpr, ctx: EvaluationContext): void {
    this.evaluate(expr, ctx);
  }

  /**
   * Execute multiple effects in sequence.
   *
   * @param effects - Array of effect S-expressions
   * @param ctx - Evaluation context with effect handlers
   */
  executeEffects(effects: SExpr[], ctx: EvaluationContext): void {
    for (const effect of effects) {
      this.executeEffect(effect, ctx);
    }
  }

  /**
   * Compile an S-expression to a function for faster repeated evaluation.
   * Same machinery as the automatic tier-up in `evaluate`; explicit callers
   * promote immediately instead of on second use.
   *
   * @param expr - S-expression to compile
   * @returns Function that evaluates the expression given a context
   */
  compile(expr: SExpr): CompiledFn {
    if (typeof expr === 'object' && expr !== null) {
      const entry = this.compileCache.get(expr);
      if (typeof entry === 'function') return entry;
      const fn = this.compileNode(expr, new Map(), undefined);
      this.compileCache.set(expr, fn);
      return fn;
    }
    return this.compileNode(expr, new Map(), undefined);
  }

  /**
   * Clear the compilation cache.
   */
  clearCache(): void {
    this.compileCache = new WeakMap();
  }

  /**
   * Dispatch to the appropriate operator implementation.
   */
  /**
   * Dispatch to the appropriate operator implementation.
   */
  private dispatchOperator(op: string, args: SExpr[], ctx: EvaluationContext): RuntimeValue {
    // Parity with the compiled path's `resolve_sexpr_call`: a registered
    // operator applied outside its canonical arity bounds throws instead of
    // silently truncating/wrapping (R-EVALUATOR-NO-ARITY-CHECK). Unregistered
    // heads fall through to the data-array handling unchanged.
    assertOperatorArity(op, args.length);
    const impl = OPERATOR_TABLE[op];
    if (impl === undefined) return UNKNOWN_OPERATOR;
    return impl(args, this.boundInterpret, ctx);
  }
}

// Export singleton instance for convenience
export const evaluator = new SExpressionEvaluator();

// Export convenience functions
export function evaluate(expr: SExpr, ctx: EvaluationContext): RuntimeValue {
  return evaluator.evaluate(expr, ctx);
}

export function evaluateGuard(expr: SExpr, ctx: EvaluationContext): boolean {
  return evaluator.evaluateGuard(expr, ctx);
}

export function executeEffect(expr: SExpr, ctx: EvaluationContext): void {
  evaluator.executeEffect(expr, ctx);
}

export function executeEffects(effects: SExpr[], ctx: EvaluationContext): void {
  evaluator.executeEffects(effects, ctx);
}
