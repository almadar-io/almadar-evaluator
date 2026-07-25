/**
 * Standard Library Runtime Evaluators
 *
 * Exports all std/* operator implementations.
 *
 * @packageDocumentation
 */

// Math operators
export {
  evalMathAbs,
  evalMathMin,
  evalMathMax,
  evalMathClamp,
  evalMathFloor,
  evalMathCeil,
  evalMathRound,
  evalMathPow,
  evalMathSqrt,
  evalMathMod,
  evalMathSign,
  evalMathLerp,
  evalMathMap,
  evalMathRandom,
  evalMathRandomInt,
  evalMathDefault,
  evalMathSin,
  evalMathCos,
  evalMathTan,
  evalMathAtan2,
  evalMathAsin,
  evalMathAcos,
  evalMathAtan,
  evalMathHypot,
  evalMathDegRad,
  evalMathRadDeg,
  evalMathWrap,
  evalMathApproach,
} from './math.js';

// Vector operators
export {
  evalVecAdd,
  evalVecSub,
  evalVecScale,
  evalVecDot,
  evalVecCross,
  evalVecLength,
  evalVecLengthSq,
  evalVecNormalize,
  evalVecDistance,
  evalVecDistanceSq,
  evalVecLerp,
  evalVecAngle,
  evalVecRotate,
  evalVecClampLength,
} from './vector.js';

// Geometry operators
export {
  evalGeoAabbOverlap,
  evalGeoCircleOverlap,
  evalGeoRectCircleOverlap,
  evalGeoPointInRect,
  evalGeoPointInCircle,
  evalGeoReflect,
  evalGeoSegmentIntersect,
} from './geo.js';

// Grid operators
export {
  evalGridToWorld,
  evalGridFromWorld,
  evalGridIsoToScreen,
  evalGridScreenToIso,
  evalGridDistance,
  evalGridManhattanDistance,
  evalGridNeighbors,
  evalGridCellsInRadius,
  evalGridLine,
  evalGridInBounds,
} from './grid.js';

// Animation operators
export {
  evalAnimFrameAt,
  evalAnimSheetRect,
  evalAnimDirectionFromDelta,
} from './anim.js';

// Easing operators
export { evalEaseApply, evalEaseSmoothstep } from './ease.js';

// Noise operators
export { evalNoisePerlin, evalNoiseSimplex, evalNoiseFbm } from './noise.js';

// Path operators
export { evalPathAstar, evalPathReachable } from './path.js';

// String operators
export {
  evalStrLen,
  evalStrConcat,
  evalStrUpper,
  evalStrLower,
  evalStrTrim,
  evalStrTrimStart,
  evalStrTrimEnd,
  evalStrSplit,
  evalStrJoin,
  evalStrSlice,
  evalStrReplace,
  evalStrReplaceAll,
  evalStrIncludes,
  evalStrStartsWith,
  evalStrEndsWith,
  evalStrPadStart,
  evalStrPadEnd,
  evalStrRepeat,
  evalStrReverse,
  evalStrCapitalize,
  evalStrTitleCase,
  evalStrCamelCase,
  evalStrKebabCase,
  evalStrSnakeCase,
  evalStrDefault,
  evalStrTemplate,
  evalStrTruncate,
} from './str.js';

// Array operators
export {
  evalArrayLen,
  evalArrayRange,
  evalArrayEmpty,
  evalArrayFirst,
  evalArrayLast,
  evalArrayNth,
  evalArraySlice,
  evalArrayConcat,
  evalArrayAppend,
  evalArrayPrepend,
  evalArrayInsert,
  evalArrayRemove,
  evalArrayRemoveItem,
  evalArrayReverse,
  evalArraySort,
  evalArrayShuffle,
  evalArrayUnique,
  evalArrayFlatten,
  evalArrayZip,
  evalArrayIncludes,
  evalArrayIndexOf,
  evalArrayFind,
  evalArrayFindIndex,
  evalArrayFilter,
  evalArrayReject,
  evalArrayMap,
  evalArrayReduce,
  evalArrayEvery,
  evalArraySome,
  evalArrayCount,
  evalArraySum,
  evalArrayAvg,
  evalArrayMin,
  evalArrayMax,
  evalArrayGroupBy,
  evalArrayPartition,
  evalArrayTake,
  evalArrayDrop,
  evalArrayTakeLast,
  evalArrayDropLast,
} from './array.js';

// Object operators
export {
  evalObjectKeys,
  evalObjectValues,
  evalObjectEntries,
  evalObjectFromEntries,
  evalObjectGet,
  evalObjectSet,
  evalObjectHas,
  evalObjectMerge,
  evalObjectDeepMerge,
  evalObjectPick,
  evalObjectOmit,
  evalObjectMapValues,
  evalObjectMapKeys,
  evalObjectFilter,
  evalObjectEmpty,
  evalObjectEquals,
  evalObjectClone,
  evalObjectDeepClone,
  evalPath,
} from './object.js';

// Validate operators
export {
  evalValidateRequired,
  evalValidateString,
  evalValidateNumber,
  evalValidateBoolean,
  evalValidateArray,
  evalValidateObject,
  evalValidateEmail,
  evalValidateUrl,
  evalValidateUuid,
  evalValidatePhone,
  evalValidateCreditCard,
  evalValidateDate,
  evalValidateMinLength,
  evalValidateMaxLength,
  evalValidateLength,
  evalValidateMin,
  evalValidateMax,
  evalValidateRange,
  evalValidatePattern,
  evalValidateOneOf,
  evalValidateNoneOf,
  evalValidateEquals,
  evalValidateCheck,
} from './validate.js';

// Time operators
export {
  evalTimeNow,
  evalTimeToday,
  evalTimeParse,
  evalTimeFormat,
  evalTimeYear,
  evalTimeMonth,
  evalTimeDay,
  evalTimeWeekday,
  evalTimeHour,
  evalTimeMinute,
  evalTimeSecond,
  evalTimeAdd,
  evalTimeSubtract,
  evalTimeDiff,
  evalTimeStartOf,
  evalTimeEndOf,
  evalTimeIsBefore,
  evalTimeIsAfter,
  evalTimeIsBetween,
  evalTimeIsSame,
  evalTimeIsPast,
  evalTimeIsFuture,
  evalTimeIsToday,
  evalTimeRelative,
  evalTimeDuration,
} from './time.js';

// Format operators
export {
  evalFormatNumber,
  evalFormatCurrency,
  evalFormatPercent,
  evalFormatBytes,
  evalFormatOrdinal,
  evalFormatPlural,
  evalFormatList,
  evalFormatPhone,
  evalFormatCreditCard,
} from './format.js';

// Async operators
export {
  evalAsyncDelay,
  evalAsyncInterval,
  evalAsyncTimeout,
  evalAsyncDebounce,
  evalAsyncThrottle,
  evalAsyncRetry,
  evalAsyncRace,
  evalAsyncAll,
  evalAsyncSequence,
  clearDebounceTimers,
  clearThrottleTimestamps,
  clearIntervalTimers,
} from './async.js';

// Probabilistic operators
export {
  evalProbSeed,
  evalProbFlip,
  evalProbGaussian,
  evalProbUniform,
  evalProbBeta,
  evalProbCategorical,
  evalProbPoisson,
  evalProbCondition,
  evalProbSample,
  evalProbPosterior,
  evalProbInfer,
  evalProbExpectedValue,
  evalProbVariance,
  evalProbHistogram,
  evalProbPercentile,
  evalProbCredibleInterval,
} from './prob.js';

// OS operators
export * from './os.js';

// ML circuit-side operators
export * from './contract.js';
export * from './graph.js';
export * from './data.js';

// Substrate operators
export * from './llm.js';
export * from './workspace.js';
export * from './session.js';
export * from './memory.js';
export * from './trace.js';
export * from './integration.js';
