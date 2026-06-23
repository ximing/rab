import {
  AssertOp,
  AssertResult,
  Assertion,
  ElementAssertion,
  RSAssertionError,
  executeAssertions,
} from './assertions';
import { ReportOptions, printAssertResult } from './reporter';

export type { AssertOp, AssertResult, Assertion, ElementAssertion, RSAssertionError };

export interface DevtoolsAssertResult extends AssertResult {
  instanceId: string;
  description?: string;
}

export class RSExpectBuilder {
  private readonly instanceId: string;
  private readonly getInstance: (id: string) => object | undefined;
  private readonly assertions: Assertion[] = [];
  private descriptionText?: string;

  constructor(instanceId: string, getInstance: (id: string) => object | undefined) {
    this.instanceId = instanceId;
    this.getInstance = getInstance;
  }

  describe(text: string): this {
    this.descriptionText = text;
    return this;
  }

  toBe(path: string, value: unknown, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Eq, value, description });
    return this;
  }

  notToBe(path: string, value: unknown, description?: string): this {
    this.assertions.push({ path, op: AssertOp.NotEq, value, description });
    return this;
  }

  toBeGreaterThan(path: string, value: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Gt, value, description });
    return this;
  }

  toBeGreaterThanOrEqual(path: string, value: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Gte, value, description });
    return this;
  }

  toBeLessThan(path: string, value: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Lt, value, description });
    return this;
  }

  toBeLessThanOrEqual(path: string, value: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Lte, value, description });
    return this;
  }

  toBeBetween(path: string, min: number, max: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Between, value: [min, max], description });
    return this;
  }

  toExist(path: string, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Exist, description });
    return this;
  }

  toNotExist(path: string, description?: string): this {
    this.assertions.push({ path, op: AssertOp.NotExist, description });
    return this;
  }

  toInclude(path: string, value: unknown, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Include, value, description });
    return this;
  }

  toNotInclude(path: string, value: unknown, description?: string): this {
    this.assertions.push({ path, op: AssertOp.NotInclude, value, description });
    return this;
  }

  toMatch(path: string, regex: RegExp, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Match, value: regex, description });
    return this;
  }

  toBeType(path: string, type: string, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Type, value: type, description });
    return this;
  }

  toHaveLength(path: string, length: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.LengthEq, value: length, description });
    return this;
  }

  toHaveLengthGt(path: string, length: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.LengthGt, value: length, description });
    return this;
  }

  toHaveLengthGte(path: string, length: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.LengthGte, value: length, description });
    return this;
  }

  toHaveLengthLt(path: string, length: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.LengthLt, value: length, description });
    return this;
  }

  toHaveLengthLte(path: string, length: number, description?: string): this {
    this.assertions.push({ path, op: AssertOp.LengthLte, value: length, description });
    return this;
  }

  toHaveKeys(path: string, keys: string[], description?: string): this {
    this.assertions.push({ path, op: AssertOp.Keys, value: keys, description });
    return this;
  }

  toMatchObject(path: string, expected: object, description?: string): this {
    this.assertions.push({ path, op: AssertOp.MatchObject, value: expected, description });
    return this;
  }

  toDeepEqual(path: string, expected: unknown, description?: string): this {
    this.assertions.push({ path, op: AssertOp.DeepEqual, value: expected, description });
    return this;
  }

  toHaveSome(path: string, elements: ElementAssertion[], description?: string): this {
    this.assertions.push({ path, op: AssertOp.Some, elements, description });
    return this;
  }

  toHaveEvery(path: string, elements: ElementAssertion[], description?: string): this {
    this.assertions.push({ path, op: AssertOp.Every, elements, description });
    return this;
  }

  assert(path: string, fn: (actual: unknown) => boolean, description?: string): this {
    this.assertions.push({ path, op: AssertOp.Custom, customFn: fn, description });
    return this;
  }

  run(): DevtoolsAssertResult {
    const instance = this.getInstance(this.instanceId);
    return executeAssertions(instance, this.assertions, this.instanceId, this.descriptionText);
  }

  check(options?: ReportOptions): boolean {
    const result = this.run();
    printAssertResult(result, options);
    return result.pass;
  }

  expect(): void {
    const result = this.run();
    if (!result.pass) {
      throw new RSAssertionError(result);
    }
  }
}

export function rsExpect(instance: object, description?: string): RSExpectBuilder {
  const builder = new RSExpectBuilder('(direct)', () => instance);
  if (description) builder.describe(description);
  return builder;
}
