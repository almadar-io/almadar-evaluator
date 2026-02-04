/**
 * Standard Library Evaluator Tests
 *
 * Tests for all std/* operator runtime evaluators.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { evaluate, evaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';

describe('StdLibraryEvaluator', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
    evaluator.clearCache();
  });

  // ========================================
  // math/* operators
  // ========================================
  describe('math/*', () => {
    it('math/abs returns absolute value', () => {
      expect(evaluate(['math/abs', -5], ctx)).toBe(5);
      expect(evaluate(['math/abs', 5], ctx)).toBe(5);
      expect(evaluate(['math/abs', 0], ctx)).toBe(0);
    });

    it('math/min returns minimum value', () => {
      expect(evaluate(['math/min', 3, 1, 4], ctx)).toBe(1);
      expect(evaluate(['math/min', 10, 20], ctx)).toBe(10);
    });

    it('math/max returns maximum value', () => {
      expect(evaluate(['math/max', 3, 1, 4], ctx)).toBe(4);
      expect(evaluate(['math/max', 10, 20], ctx)).toBe(20);
    });

    it('math/clamp constrains value to range', () => {
      expect(evaluate(['math/clamp', 150, 0, 100], ctx)).toBe(100);
      expect(evaluate(['math/clamp', -10, 0, 100], ctx)).toBe(0);
      expect(evaluate(['math/clamp', 50, 0, 100], ctx)).toBe(50);
    });

    it('math/floor rounds down', () => {
      expect(evaluate(['math/floor', 3.7], ctx)).toBe(3);
      expect(evaluate(['math/floor', 3.2], ctx)).toBe(3);
      expect(evaluate(['math/floor', -3.7], ctx)).toBe(-4);
    });

    it('math/ceil rounds up', () => {
      expect(evaluate(['math/ceil', 3.2], ctx)).toBe(4);
      expect(evaluate(['math/ceil', 3.7], ctx)).toBe(4);
      expect(evaluate(['math/ceil', -3.7], ctx)).toBe(-3);
    });

    it('math/round rounds to nearest', () => {
      expect(evaluate(['math/round', 3.5], ctx)).toBe(4);
      expect(evaluate(['math/round', 3.4], ctx)).toBe(3);
      expect(evaluate(['math/round', 3.456, 2], ctx)).toBe(3.46);
    });

    it('math/pow calculates power', () => {
      expect(evaluate(['math/pow', 2, 8], ctx)).toBe(256);
      expect(evaluate(['math/pow', 3, 2], ctx)).toBe(9);
    });

    it('math/sqrt calculates square root', () => {
      expect(evaluate(['math/sqrt', 16], ctx)).toBe(4);
      expect(evaluate(['math/sqrt', 9], ctx)).toBe(3);
    });

    it('math/mod calculates modulo', () => {
      expect(evaluate(['math/mod', 7, 3], ctx)).toBe(1);
      expect(evaluate(['math/mod', 10, 5], ctx)).toBe(0);
    });

    it('math/sign returns sign', () => {
      expect(evaluate(['math/sign', -42], ctx)).toBe(-1);
      expect(evaluate(['math/sign', 42], ctx)).toBe(1);
      expect(evaluate(['math/sign', 0], ctx)).toBe(0);
    });

    it('math/lerp interpolates linearly', () => {
      expect(evaluate(['math/lerp', 0, 100, 0.5], ctx)).toBe(50);
      expect(evaluate(['math/lerp', 0, 100, 0], ctx)).toBe(0);
      expect(evaluate(['math/lerp', 0, 100, 1], ctx)).toBe(100);
    });

    it('math/map maps value between ranges', () => {
      expect(evaluate(['math/map', 5, 0, 10, 0, 100], ctx)).toBe(50);
      expect(evaluate(['math/map', 0, 0, 10, 0, 100], ctx)).toBe(0);
    });

    it('math/random returns number between 0 and 1', () => {
      const result = evaluate(['math/random'], ctx) as number;
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });

    it('math/randomInt returns integer in range', () => {
      const result = evaluate(['math/randomInt', 1, 6], ctx) as number;
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('math/default returns default for null/undefined/NaN', () => {
      ctx = createMinimalContext({ value: null }, {});
      expect(evaluate(['math/default', '@entity.value', 0], ctx)).toBe(0);
      expect(evaluate(['math/default', 5, 0], ctx)).toBe(5);
    });
  });

  // ========================================
  // str/* operators
  // ========================================
  describe('str/*', () => {
    it('str/len returns string length', () => {
      expect(evaluate(['str/len', 'hello'], ctx)).toBe(5);
      expect(evaluate(['str/len', ''], ctx)).toBe(0);
    });

    it('str/upper converts to uppercase', () => {
      expect(evaluate(['str/upper', 'hello'], ctx)).toBe('HELLO');
    });

    it('str/lower converts to lowercase', () => {
      expect(evaluate(['str/lower', 'HELLO'], ctx)).toBe('hello');
    });

    it('str/trim removes whitespace', () => {
      expect(evaluate(['str/trim', '  hello  '], ctx)).toBe('hello');
    });

    it('str/split splits string by delimiter', () => {
      expect(evaluate(['str/split', 'a,b,c', ','], ctx)).toEqual(['a', 'b', 'c']);
    });

    it('str/join joins array with delimiter', () => {
      ctx = createMinimalContext({ arr: ['a', 'b', 'c'] }, {});
      expect(evaluate(['str/join', '@entity.arr', ', '], ctx)).toBe('a, b, c');
    });

    it('str/slice extracts substring', () => {
      expect(evaluate(['str/slice', 'hello', 1, 4], ctx)).toBe('ell');
      expect(evaluate(['str/slice', 'hello', 1], ctx)).toBe('ello');
    });

    it('str/replace replaces first occurrence', () => {
      expect(evaluate(['str/replace', 'hello world', 'world', 'there'], ctx)).toBe('hello there');
    });

    it('str/replaceAll replaces all occurrences', () => {
      expect(evaluate(['str/replaceAll', 'a-b-c', '-', '_'], ctx)).toBe('a_b_c');
    });

    it('str/includes checks for substring', () => {
      expect(evaluate(['str/includes', 'hello world', 'world'], ctx)).toBe(true);
      expect(evaluate(['str/includes', 'hello world', 'foo'], ctx)).toBe(false);
    });

    it('str/startsWith checks prefix', () => {
      expect(evaluate(['str/startsWith', 'hello', 'hel'], ctx)).toBe(true);
      expect(evaluate(['str/startsWith', 'hello', 'ell'], ctx)).toBe(false);
    });

    it('str/endsWith checks suffix', () => {
      expect(evaluate(['str/endsWith', 'hello', 'lo'], ctx)).toBe(true);
    });

    it('str/padStart pads from start', () => {
      expect(evaluate(['str/padStart', '5', 3, '0'], ctx)).toBe('005');
    });

    it('str/padEnd pads from end', () => {
      expect(evaluate(['str/padEnd', '5', 3, '0'], ctx)).toBe('500');
    });

    it('str/repeat repeats string', () => {
      expect(evaluate(['str/repeat', 'ab', 3], ctx)).toBe('ababab');
    });

    it('str/reverse reverses string', () => {
      expect(evaluate(['str/reverse', 'hello'], ctx)).toBe('olleh');
    });

    it('str/capitalize capitalizes first character', () => {
      expect(evaluate(['str/capitalize', 'hello'], ctx)).toBe('Hello');
    });

    it('str/titleCase converts to title case', () => {
      expect(evaluate(['str/titleCase', 'hello world'], ctx)).toBe('Hello World');
    });

    it('str/camelCase converts to camelCase', () => {
      expect(evaluate(['str/camelCase', 'hello world'], ctx)).toBe('helloWorld');
    });

    it('str/kebabCase converts to kebab-case', () => {
      expect(evaluate(['str/kebabCase', 'Hello World'], ctx)).toBe('hello-world');
    });

    it('str/snakeCase converts to snake_case', () => {
      expect(evaluate(['str/snakeCase', 'Hello World'], ctx)).toBe('hello_world');
    });

    it('str/default returns default for null/empty', () => {
      expect(evaluate(['str/default', null, 'N/A'], ctx)).toBe('N/A');
      expect(evaluate(['str/default', '', 'N/A'], ctx)).toBe('N/A');
      expect(evaluate(['str/default', 'hello', 'N/A'], ctx)).toBe('hello');
    });

    it('str/template substitutes variables', () => {
      expect(
        evaluate(['str/template', 'Hello, {name}!', { name: 'World' }], ctx)
      ).toBe('Hello, World!');
    });

    it('str/truncate truncates with suffix', () => {
      expect(evaluate(['str/truncate', 'Hello World', 8, '...'], ctx)).toBe('Hello...');
    });
  });

  // ========================================
  // array/* operators
  // ========================================
  describe('array/*', () => {
    it('array/len returns array length', () => {
      expect(evaluate(['array/len', [1, 2, 3]], ctx)).toBe(3);
    });

    it('array/empty? checks if array is empty', () => {
      expect(evaluate(['array/empty?', []], ctx)).toBe(true);
      expect(evaluate(['array/empty?', [1]], ctx)).toBe(false);
    });

    it('array/first returns first element', () => {
      expect(evaluate(['array/first', [1, 2, 3]], ctx)).toBe(1);
    });

    it('array/last returns last element', () => {
      expect(evaluate(['array/last', [1, 2, 3]], ctx)).toBe(3);
    });

    it('array/nth returns element at index', () => {
      expect(evaluate(['array/nth', [1, 2, 3], 1], ctx)).toBe(2);
    });

    it('array/slice extracts subarray', () => {
      expect(evaluate(['array/slice', [1, 2, 3, 4], 1, 3], ctx)).toEqual([2, 3]);
    });

    it('array/concat concatenates arrays', () => {
      expect(evaluate(['array/concat', [1, 2], [3, 4]], ctx)).toEqual([1, 2, 3, 4]);
    });

    it('array/append adds item to end', () => {
      expect(evaluate(['array/append', [1, 2], 3], ctx)).toEqual([1, 2, 3]);
    });

    it('array/prepend adds item to start', () => {
      expect(evaluate(['array/prepend', [2, 3], 1], ctx)).toEqual([1, 2, 3]);
    });

    it('array/insert inserts at index', () => {
      expect(evaluate(['array/insert', [1, 3], 1, 2], ctx)).toEqual([1, 2, 3]);
    });

    it('array/remove removes at index', () => {
      expect(evaluate(['array/remove', [1, 2, 3], 1], ctx)).toEqual([1, 3]);
    });

    it('array/reverse reverses array', () => {
      expect(evaluate(['array/reverse', [1, 2, 3]], ctx)).toEqual([3, 2, 1]);
    });

    it('array/sort sorts array', () => {
      expect(evaluate(['array/sort', [3, 1, 2]], ctx)).toEqual([1, 2, 3]);
    });

    it('array/unique removes duplicates', () => {
      expect(evaluate(['array/unique', [1, 2, 2, 3, 1]], ctx)).toEqual([1, 2, 3]);
    });

    it('array/flatten flattens one level', () => {
      expect(evaluate(['array/flatten', [[1, 2], [3, 4]]], ctx)).toEqual([1, 2, 3, 4]);
    });

    it('array/includes checks for item', () => {
      expect(evaluate(['array/includes', [1, 2, 3], 2], ctx)).toBe(true);
      expect(evaluate(['array/includes', [1, 2, 3], 5], ctx)).toBe(false);
    });

    it('array/indexOf finds index', () => {
      expect(evaluate(['array/indexOf', [1, 2, 3], 2], ctx)).toBe(1);
      expect(evaluate(['array/indexOf', [1, 2, 3], 5], ctx)).toBe(-1);
    });

    it('array/filter filters with lambda', () => {
      ctx = createMinimalContext({ items: [1, 2, 3, 4, 5] }, {});
      const result = evaluate(
        ['array/filter', '@entity.items', ['fn', 'x', ['>', '@x', 2]]],
        ctx
      );
      expect(result).toEqual([3, 4, 5]);
    });

    it('array/map transforms with lambda', () => {
      ctx = createMinimalContext({ items: [1, 2, 3] }, {});
      const result = evaluate(
        ['array/map', '@entity.items', ['fn', 'x', ['*', '@x', 2]]],
        ctx
      );
      expect(result).toEqual([2, 4, 6]);
    });

    it('array/reduce reduces with lambda', () => {
      ctx = createMinimalContext({ items: [1, 2, 3, 4] }, {});
      const result = evaluate(
        ['array/reduce', '@entity.items', ['fn', ['acc', 'x'], ['+', '@acc', '@x']], 0],
        ctx
      );
      expect(result).toBe(10);
    });

    it('array/every checks all match', () => {
      ctx = createMinimalContext({ items: [2, 4, 6] }, {});
      expect(
        evaluate(['array/every', '@entity.items', ['fn', 'x', ['=', ['%', '@x', 2], 0]]], ctx)
      ).toBe(true);
    });

    it('array/some checks any match', () => {
      ctx = createMinimalContext({ items: [1, 2, 3] }, {});
      expect(
        evaluate(['array/some', '@entity.items', ['fn', 'x', ['>', '@x', 2]]], ctx)
      ).toBe(true);
    });

    it('array/sum calculates sum', () => {
      expect(evaluate(['array/sum', [1, 2, 3, 4]], ctx)).toBe(10);
    });

    it('array/avg calculates average', () => {
      expect(evaluate(['array/avg', [2, 4, 6]], ctx)).toBe(4);
    });

    it('array/take takes first n elements', () => {
      expect(evaluate(['array/take', [1, 2, 3, 4, 5], 3], ctx)).toEqual([1, 2, 3]);
    });

    it('array/drop skips first n elements', () => {
      expect(evaluate(['array/drop', [1, 2, 3, 4, 5], 2], ctx)).toEqual([3, 4, 5]);
    });

    it('array/groupBy groups by field', () => {
      ctx = createMinimalContext(
        {
          items: [
            { status: 'active', name: 'a' },
            { status: 'inactive', name: 'b' },
            { status: 'active', name: 'c' },
          ],
        },
        {}
      );
      const result = evaluate(['array/groupBy', '@entity.items', 'status'], ctx);
      expect(result).toEqual({
        active: [
          { status: 'active', name: 'a' },
          { status: 'active', name: 'c' },
        ],
        inactive: [{ status: 'inactive', name: 'b' }],
      });
    });
  });

  // ========================================
  // object/* operators
  // ========================================
  describe('object/*', () => {
    it('object/keys returns keys', () => {
      expect(evaluate(['object/keys', { a: 1, b: 2 }], ctx)).toEqual(['a', 'b']);
    });

    it('object/values returns values', () => {
      expect(evaluate(['object/values', { a: 1, b: 2 }], ctx)).toEqual([1, 2]);
    });

    it('object/entries returns entries', () => {
      expect(evaluate(['object/entries', { a: 1 }], ctx)).toEqual([['a', 1]]);
    });

    it('object/fromEntries creates object', () => {
      expect(
        evaluate(
          ['object/fromEntries', [['a', 1], ['b', 2]]],
          ctx
        )
      ).toEqual({ a: 1, b: 2 });
    });

    it('object/get gets nested value', () => {
      ctx = createMinimalContext({ user: { profile: { name: 'John' } } }, {});
      expect(evaluate(['object/get', '@entity.user', 'profile.name'], ctx)).toBe('John');
      expect(evaluate(['object/get', '@entity.user', 'profile.age', 25], ctx)).toBe(25);
    });

    it('object/set sets nested value', () => {
      const result = evaluate(['object/set', { a: 1 }, 'b', 2], ctx);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('object/has checks path exists', () => {
      ctx = createMinimalContext({ user: { name: 'John' } }, {});
      expect(evaluate(['object/has', '@entity.user', 'name'], ctx)).toBe(true);
      expect(evaluate(['object/has', '@entity.user', 'age'], ctx)).toBe(false);
    });

    it('object/merge merges objects', () => {
      expect(evaluate(['object/merge', { a: 1 }, { b: 2 }], ctx)).toEqual({ a: 1, b: 2 });
    });

    it('object/deepMerge deep merges objects', () => {
      expect(
        evaluate(['object/deepMerge', { a: { b: 1 } }, { a: { c: 2 } }], ctx)
      ).toEqual({ a: { b: 1, c: 2 } });
    });

    it('object/pick selects keys', () => {
      ctx = createMinimalContext({ obj: { a: 1, b: 2, c: 3 }, keys: ['a', 'c'] }, {});
      expect(evaluate(['object/pick', '@entity.obj', '@entity.keys'], ctx)).toEqual({
        a: 1,
        c: 3,
      });
    });

    it('object/omit excludes keys', () => {
      ctx = createMinimalContext({ obj: { a: 1, b: 2, c: 3 }, keys: ['b'] }, {});
      expect(evaluate(['object/omit', '@entity.obj', '@entity.keys'], ctx)).toEqual({
        a: 1,
        c: 3,
      });
    });

    it('object/empty? checks if empty', () => {
      expect(evaluate(['object/empty?', {}], ctx)).toBe(true);
      expect(evaluate(['object/empty?', { a: 1 }], ctx)).toBe(false);
    });

    it('object/equals checks deep equality', () => {
      expect(evaluate(['object/equals', { a: 1 }, { a: 1 }], ctx)).toBe(true);
      expect(evaluate(['object/equals', { a: 1 }, { a: 2 }], ctx)).toBe(false);
    });

    it('object/clone creates shallow copy', () => {
      const original = { a: 1, b: { c: 2 } };
      const result = evaluate(['object/clone', original], ctx) as Record<string, unknown>;
      expect(result).toEqual(original);
      expect(result).not.toBe(original);
    });
  });

  // ========================================
  // validate/* operators
  // ========================================
  describe('validate/*', () => {
    it('validate/required checks for value', () => {
      expect(evaluate(['validate/required', 'hello'], ctx)).toBe(true);
      expect(evaluate(['validate/required', ''], ctx)).toBe(false);
      expect(evaluate(['validate/required', null], ctx)).toBe(false);
    });

    it('validate/email validates email format', () => {
      expect(evaluate(['validate/email', 'test@example.com'], ctx)).toBe(true);
      expect(evaluate(['validate/email', 'invalid'], ctx)).toBe(false);
    });

    it('validate/url validates URL format', () => {
      expect(evaluate(['validate/url', 'https://example.com'], ctx)).toBe(true);
      expect(evaluate(['validate/url', 'not-a-url'], ctx)).toBe(false);
    });

    it('validate/minLength checks minimum length', () => {
      expect(evaluate(['validate/minLength', 'hello', 3], ctx)).toBe(true);
      expect(evaluate(['validate/minLength', 'hi', 3], ctx)).toBe(false);
    });

    it('validate/maxLength checks maximum length', () => {
      expect(evaluate(['validate/maxLength', 'hi', 5], ctx)).toBe(true);
      expect(evaluate(['validate/maxLength', 'hello world', 5], ctx)).toBe(false);
    });

    it('validate/min checks minimum value', () => {
      expect(evaluate(['validate/min', 25, 18], ctx)).toBe(true);
      expect(evaluate(['validate/min', 15, 18], ctx)).toBe(false);
    });

    it('validate/max checks maximum value', () => {
      expect(evaluate(['validate/max', 50, 100], ctx)).toBe(true);
      expect(evaluate(['validate/max', 150, 100], ctx)).toBe(false);
    });

    it('validate/range checks value in range', () => {
      expect(evaluate(['validate/range', 3, 1, 5], ctx)).toBe(true);
      expect(evaluate(['validate/range', 10, 1, 5], ctx)).toBe(false);
    });

    it('validate/pattern checks regex pattern', () => {
      expect(evaluate(['validate/pattern', 'ABC123', '^[A-Z]{3}[0-9]{3}$'], ctx)).toBe(true);
      expect(evaluate(['validate/pattern', 'abc', '^[A-Z]{3}[0-9]{3}$'], ctx)).toBe(false);
    });

    it('validate/oneOf checks value in list', () => {
      ctx = createMinimalContext({ options: ['admin', 'user', 'guest'] }, {});
      expect(evaluate(['validate/oneOf', 'admin', '@entity.options'], ctx)).toBe(true);
      expect(evaluate(['validate/oneOf', 'hacker', '@entity.options'], ctx)).toBe(false);
    });

    it('validate/check runs multiple validations', () => {
      const result = evaluate(
        [
          'validate/check',
          { name: 'Jo', email: 'invalid' },
          {
            name: [['required'], ['minLength', 3]],
            email: [['required'], ['email']],
          },
        ],
        ctx
      ) as { valid: boolean; errors: string[] };
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name: minLength validation failed');
      expect(result.errors).toContain('email: email validation failed');
    });
  });

  // ========================================
  // time/* operators
  // ========================================
  describe('time/*', () => {
    it('time/now returns current timestamp', () => {
      const before = Date.now();
      const result = evaluate(['time/now'], ctx) as number;
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it('time/today returns midnight timestamp', () => {
      const result = evaluate(['time/today'], ctx) as number;
      const date = new Date(result);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });

    it('time/format formats timestamp', () => {
      const timestamp = new Date('2024-01-18T14:30:00').getTime();
      expect(evaluate(['time/format', timestamp, 'YYYY-MM-DD'], ctx)).toBe('2024-01-18');
    });

    it('time/year extracts year', () => {
      const timestamp = new Date('2024-01-18').getTime();
      expect(evaluate(['time/year', timestamp], ctx)).toBe(2024);
    });

    it('time/month extracts month', () => {
      const timestamp = new Date('2024-01-18').getTime();
      expect(evaluate(['time/month', timestamp], ctx)).toBe(1);
    });

    it('time/day extracts day', () => {
      const timestamp = new Date('2024-01-18').getTime();
      expect(evaluate(['time/day', timestamp], ctx)).toBe(18);
    });

    it('time/add adds time', () => {
      const timestamp = new Date('2024-01-18').getTime();
      const result = evaluate(['time/add', timestamp, 7, 'day'], ctx) as number;
      expect(new Date(result).getDate()).toBe(25);
    });

    it('time/subtract subtracts time', () => {
      const timestamp = new Date('2024-01-18').getTime();
      const result = evaluate(['time/subtract', timestamp, 1, 'month'], ctx) as number;
      expect(new Date(result).getMonth()).toBe(11); // December (0-indexed)
    });

    it('time/diff calculates difference', () => {
      const a = new Date('2024-01-18').getTime();
      const b = new Date('2024-01-11').getTime();
      expect(evaluate(['time/diff', a, b, 'day'], ctx)).toBe(7);
    });

    it('time/isBefore compares timestamps', () => {
      const a = new Date('2024-01-10').getTime();
      const b = new Date('2024-01-18').getTime();
      expect(evaluate(['time/isBefore', a, b], ctx)).toBe(true);
      expect(evaluate(['time/isBefore', b, a], ctx)).toBe(false);
    });

    it('time/isAfter compares timestamps', () => {
      const a = new Date('2024-01-18').getTime();
      const b = new Date('2024-01-10').getTime();
      expect(evaluate(['time/isAfter', a, b], ctx)).toBe(true);
    });

    it('time/duration formats duration', () => {
      expect(evaluate(['time/duration', 9000000], ctx)).toBe('2h 30m');
      expect(evaluate(['time/duration', 60000], ctx)).toBe('1m');
    });
  });

  // ========================================
  // format/* operators
  // ========================================
  describe('format/*', () => {
    it('format/number formats with separators', () => {
      const result = evaluate(['format/number', 1234567.89], ctx) as string;
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    it('format/currency formats as currency', () => {
      const result = evaluate(['format/currency', 1234.56, 'USD'], ctx) as string;
      expect(result).toContain('$');
      expect(result).toContain('1,234');
    });

    it('format/percent formats as percentage', () => {
      const result = evaluate(['format/percent', 0.856, 1], ctx) as string;
      expect(result).toContain('85.6');
      expect(result).toContain('%');
    });

    it('format/bytes formats file size', () => {
      expect(evaluate(['format/bytes', 2500000], ctx)).toBe('2.4 MB');
      expect(evaluate(['format/bytes', 1024], ctx)).toBe('1 KB');
    });

    it('format/ordinal formats as ordinal', () => {
      expect(evaluate(['format/ordinal', 1], ctx)).toBe('1st');
      expect(evaluate(['format/ordinal', 2], ctx)).toBe('2nd');
      expect(evaluate(['format/ordinal', 3], ctx)).toBe('3rd');
      expect(evaluate(['format/ordinal', 4], ctx)).toBe('4th');
      expect(evaluate(['format/ordinal', 11], ctx)).toBe('11th');
      expect(evaluate(['format/ordinal', 21], ctx)).toBe('21st');
    });

    it('format/plural formats with count', () => {
      expect(evaluate(['format/plural', 1, 'item', 'items'], ctx)).toBe('1 item');
      expect(evaluate(['format/plural', 5, 'item', 'items'], ctx)).toBe('5 items');
    });

    it('format/list formats as list', () => {
      ctx = createMinimalContext({ names3: ['Alice', 'Bob', 'Charlie'], names2: ['Alice', 'Bob'] }, {});
      expect(
        evaluate(['format/list', '@entity.names3', 'and'], ctx)
      ).toBe('Alice, Bob, and Charlie');
      expect(evaluate(['format/list', '@entity.names2', 'or'], ctx)).toBe('Alice or Bob');
    });

    it('format/phone formats phone number', () => {
      expect(evaluate(['format/phone', '5551234567'], ctx)).toBe('(555) 123-4567');
    });

    it('format/creditCard masks card number', () => {
      const result = evaluate(['format/creditCard', '4111111111111234'], ctx) as string;
      expect(result).toContain('1234');
      expect(result).toContain('•');
    });
  });

  // ========================================
  // async/* operators
  // ========================================
  describe('async/*', () => {
    it('async/delay waits for specified time', async () => {
      const start = Date.now();
      await evaluate(['async/delay', 50], ctx);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('async/all executes in parallel', async () => {
      const results = await evaluate(
        ['async/all', ['+', 1, 1], ['+', 2, 2], ['+', 3, 3]],
        ctx
      );
      expect(results).toEqual([2, 4, 6]);
    });

    it('async/sequence executes in order', async () => {
      const results = await evaluate(
        ['async/sequence', ['+', 1, 1], ['+', 2, 2]],
        ctx
      );
      expect(results).toEqual([2, 4]);
    });

    it('async/debounce emits after delay', async () => {
      const emitSpy = vi.fn();
      ctx.emit = emitSpy;

      evaluate(['async/debounce', 'SEARCH', 50], ctx);
      expect(emitSpy).not.toHaveBeenCalled();

      await new Promise((r) => setTimeout(r, 100));
      expect(emitSpy).toHaveBeenCalledWith('SEARCH');
    });

    it('async/throttle limits emission rate', () => {
      const emitSpy = vi.fn();
      ctx.emit = emitSpy;

      evaluate(['async/throttle', 'SCROLL', 100], ctx);
      evaluate(['async/throttle', 'SCROLL', 100], ctx);
      evaluate(['async/throttle', 'SCROLL', 100], ctx);

      // Only first should emit due to throttle
      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });
});
