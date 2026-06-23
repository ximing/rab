export enum AssertOp {
  Eq = 'eq',
  NotEq = 'notEq',
  Gt = 'gt',
  Gte = 'gte',
  Lt = 'lt',
  Lte = 'lte',
  Between = 'between',
  Exist = 'exist',
  NotExist = 'notExist',
  Include = 'include',
  NotInclude = 'notInclude',
  Match = 'match',
  Type = 'type',
  LengthEq = 'lengthEq',
  LengthGt = 'lengthGt',
  LengthGte = 'lengthGte',
  LengthLt = 'lengthLt',
  LengthLte = 'lengthLte',
  Keys = 'keys',
  MatchObject = 'matchObject',
  DeepEqual = 'deepEqual',
  Some = 'some',
  Every = 'every',
  Custom = 'custom',
}

export interface ElementAssertion {
  path: string;
  op: AssertOp;
  value?: unknown;
}

export interface Assertion {
  path: string;
  op: AssertOp;
  value?: unknown;
  description?: string;
  elements?: ElementAssertion[];
  customFn?: (actual: unknown) => boolean;
}

export interface AssertionResult {
  pass: boolean;
  path: string;
  op: AssertOp;
  actual: unknown;
  expected?: unknown;
  description?: string;
  error?: Error;
}

export interface AssertResult {
  pass: boolean;
  instanceId: string;
  description?: string;
  results: AssertionResult[];
}

export class RSAssertionError extends Error {
  result: AssertResult;
  constructor(result: AssertResult) {
    const failed = result.results.filter(r => !r.pass);
    super(
      `Assertion failed for "${result.instanceId}": ${failed.map(r => r.path).join(', ')}`
    );
    this.name = 'RSAssertionError';
    this.result = result;
  }
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path || path === '.') return obj;
  return path.split('.').reduce((cur: unknown, key) => {
    if (cur == null) return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

function matchObject(actual: unknown, expected: unknown): boolean {
  if (typeof actual !== 'object' || actual == null) return false;
  if (typeof expected !== 'object' || expected == null) return false;
  return Object.keys(expected as object).every(k =>
    deepEqual(
      (actual as Record<string, unknown>)[k],
      (expected as Record<string, unknown>)[k]
    )
  );
}

function evalAssertion(actual: unknown, assertion: Assertion): boolean {
  const { op, value } = assertion;
  switch (op) {
    case AssertOp.Eq:
      return actual === value;
    case AssertOp.NotEq:
      return actual !== value;
    case AssertOp.Gt:
      return (actual as number) > (value as number);
    case AssertOp.Gte:
      return (actual as number) >= (value as number);
    case AssertOp.Lt:
      return (actual as number) < (value as number);
    case AssertOp.Lte:
      return (actual as number) <= (value as number);
    case AssertOp.Between: {
      const [min, max] = value as [number, number];
      return (actual as number) >= min && (actual as number) <= max;
    }
    case AssertOp.Exist:
      return actual != null;
    case AssertOp.NotExist:
      return actual == null;
    case AssertOp.Include:
      if (typeof actual === 'string') return actual.includes(value as string);
      if (Array.isArray(actual)) return actual.includes(value);
      return false;
    case AssertOp.NotInclude:
      if (typeof actual === 'string') return !actual.includes(value as string);
      if (Array.isArray(actual)) return !actual.includes(value);
      return true;
    case AssertOp.Match:
      return (value as RegExp).test(String(actual));
    case AssertOp.Type:
      return typeof actual === value;
    case AssertOp.LengthEq:
      return (actual as ArrayLike<unknown>).length === value;
    case AssertOp.LengthGt:
      return (actual as ArrayLike<unknown>).length > (value as number);
    case AssertOp.LengthGte:
      return (actual as ArrayLike<unknown>).length >= (value as number);
    case AssertOp.LengthLt:
      return (actual as ArrayLike<unknown>).length < (value as number);
    case AssertOp.LengthLte:
      return (actual as ArrayLike<unknown>).length <= (value as number);
    case AssertOp.Keys: {
      if (typeof actual !== 'object' || actual == null) return false;
      const keys = value as string[];
      return keys.every(k => k in (actual as object));
    }
    case AssertOp.MatchObject:
      return matchObject(actual, value);
    case AssertOp.DeepEqual:
      return deepEqual(actual, value);
    case AssertOp.Some: {
      if (!Array.isArray(actual)) return false;
      const elAssertions = assertion.elements ?? [];
      return actual.some(item =>
        elAssertions.every(ea => evalAssertion(getByPath(item, ea.path), ea))
      );
    }
    case AssertOp.Every: {
      if (!Array.isArray(actual)) return false;
      const elAssertions = assertion.elements ?? [];
      return actual.every(item =>
        elAssertions.every(ea => evalAssertion(getByPath(item, ea.path), ea))
      );
    }
    case AssertOp.Custom:
      return assertion.customFn ? assertion.customFn(actual) : false;
    default:
      return false;
  }
}

export function executeAssertions(
  instance: unknown,
  assertions: Assertion[],
  instanceId: string,
  description?: string
): AssertResult {
  const results: AssertionResult[] = assertions.map(assertion => {
    const actual = getByPath(instance, assertion.path);
    let pass = false;
    let error: Error | undefined;
    try {
      pass = evalAssertion(actual, assertion);
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
    return {
      pass,
      path: assertion.path,
      op: assertion.op,
      actual,
      expected: assertion.value,
      description: assertion.description,
      error,
    };
  });

  return {
    pass: results.every(r => r.pass),
    instanceId,
    description,
    results,
  };
}
