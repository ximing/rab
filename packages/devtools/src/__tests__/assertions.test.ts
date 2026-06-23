import {
  AssertOp,
  RSAssertionError,
  executeAssertions,
} from '../assert/assertions';

const obj = {
  name: 'Alice',
  age: 30,
  score: 75,
  tags: ['a', 'b', 'c'],
  address: { city: 'Shanghai' },
  items: [{ id: 1, active: true }, { id: 2, active: false }],
  empty: null,
  undef: undefined,
};

function run(op: AssertOp, path: string, value?: unknown, extra?: object) {
  return executeAssertions(obj, [{ path, op, value, ...extra }], 'test#0');
}

describe('executeAssertions', () => {
  describe('Eq / NotEq', () => {
    it('passes when equal', () => expect(run(AssertOp.Eq, 'name', 'Alice').pass).toBe(true));
    it('fails when not equal', () => expect(run(AssertOp.Eq, 'name', 'Bob').pass).toBe(false));
    it('notEq passes', () => expect(run(AssertOp.NotEq, 'name', 'Bob').pass).toBe(true));
    it('notEq fails when equal', () => expect(run(AssertOp.NotEq, 'name', 'Alice').pass).toBe(false));
  });

  describe('numeric comparisons', () => {
    it('Gt passes', () => expect(run(AssertOp.Gt, 'age', 20).pass).toBe(true));
    it('Gt fails', () => expect(run(AssertOp.Gt, 'age', 30).pass).toBe(false));
    it('Gte passes on equal', () => expect(run(AssertOp.Gte, 'age', 30).pass).toBe(true));
    it('Lt passes', () => expect(run(AssertOp.Lt, 'age', 40).pass).toBe(true));
    it('Lte passes on equal', () => expect(run(AssertOp.Lte, 'age', 30).pass).toBe(true));
    it('Between passes inside range', () => expect(run(AssertOp.Between, 'score', [50, 100]).pass).toBe(true));
    it('Between fails outside range', () => expect(run(AssertOp.Between, 'score', [80, 100]).pass).toBe(false));
  });

  describe('existence', () => {
    it('Exist passes when value is non-null', () => expect(run(AssertOp.Exist, 'name').pass).toBe(true));
    it('Exist fails when null', () => expect(run(AssertOp.Exist, 'empty').pass).toBe(false));
    it('Exist fails when undefined', () => expect(run(AssertOp.Exist, 'undef').pass).toBe(false));
    it('NotExist passes when null', () => expect(run(AssertOp.NotExist, 'empty').pass).toBe(true));
    it('NotExist fails when value exists', () => expect(run(AssertOp.NotExist, 'name').pass).toBe(false));
  });

  describe('Include / NotInclude', () => {
    it('Include passes for array element', () => expect(run(AssertOp.Include, 'tags', 'a').pass).toBe(true));
    it('Include fails for missing array element', () => expect(run(AssertOp.Include, 'tags', 'z').pass).toBe(false));
    it('Include passes for substring', () => expect(run(AssertOp.Include, 'name', 'lic').pass).toBe(true));
    it('NotInclude passes for missing element', () => expect(run(AssertOp.NotInclude, 'tags', 'z').pass).toBe(true));
    it('NotInclude fails for present element', () => expect(run(AssertOp.NotInclude, 'tags', 'a').pass).toBe(false));
  });

  describe('Match', () => {
    it('passes on regex match', () => expect(run(AssertOp.Match, 'name', /^Ali/).pass).toBe(true));
    it('fails on no match', () => expect(run(AssertOp.Match, 'name', /^Bob/).pass).toBe(false));
  });

  describe('Type', () => {
    it('passes for correct type', () => expect(run(AssertOp.Type, 'age', 'number').pass).toBe(true));
    it('fails for wrong type', () => expect(run(AssertOp.Type, 'age', 'string').pass).toBe(false));
  });

  describe('Length ops', () => {
    it('LengthEq passes', () => expect(run(AssertOp.LengthEq, 'tags', 3).pass).toBe(true));
    it('LengthEq fails', () => expect(run(AssertOp.LengthEq, 'tags', 5).pass).toBe(false));
    it('LengthGt passes', () => expect(run(AssertOp.LengthGt, 'tags', 2).pass).toBe(true));
    it('LengthGte passes on equal', () => expect(run(AssertOp.LengthGte, 'tags', 3).pass).toBe(true));
    it('LengthLt passes', () => expect(run(AssertOp.LengthLt, 'tags', 5).pass).toBe(true));
    it('LengthLte passes on equal', () => expect(run(AssertOp.LengthLte, 'tags', 3).pass).toBe(true));
  });

  describe('Keys', () => {
    it('passes when all keys exist', () => expect(run(AssertOp.Keys, 'address', ['city']).pass).toBe(true));
    it('fails when a key is missing', () => expect(run(AssertOp.Keys, 'address', ['city', 'zip']).pass).toBe(false));
  });

  describe('MatchObject', () => {
    it('passes when subset matches', () => expect(run(AssertOp.MatchObject, 'address', { city: 'Shanghai' }).pass).toBe(true));
    it('fails when value differs', () => expect(run(AssertOp.MatchObject, 'address', { city: 'Beijing' }).pass).toBe(false));
  });

  describe('DeepEqual', () => {
    it('passes on deep equality', () => expect(run(AssertOp.DeepEqual, 'address', { city: 'Shanghai' }).pass).toBe(true));
    it('fails on deep inequality', () => expect(run(AssertOp.DeepEqual, 'address', { city: 'Beijing' }).pass).toBe(false));
  });

  describe('Some / Every', () => {
    it('Some passes when at least one element matches', () =>
      expect(
        run(AssertOp.Some, 'items', undefined, {
          elements: [{ path: 'active', op: AssertOp.Eq, value: true }],
        })
          .pass
      ).toBe(true));

    it('Some fails when no element matches', () =>
      expect(
        run(AssertOp.Some, 'items', undefined, {
          elements: [{ path: 'id', op: AssertOp.Eq, value: 99 }],
        })
          .pass
      ).toBe(false));

    it('Every fails when not all elements match', () =>
      expect(
        run(AssertOp.Every, 'items', undefined, {
          elements: [{ path: 'active', op: AssertOp.Eq, value: true }],
        })
          .pass
      ).toBe(false));

    it('Every passes when all elements match', () =>
      expect(
        run(AssertOp.Every, 'items', undefined, {
          elements: [{ path: 'id', op: AssertOp.Exist }],
        })
          .pass
      ).toBe(true));
  });

  describe('Custom', () => {
    it('passes when fn returns true', () =>
      expect(run(AssertOp.Custom, 'age', undefined, { customFn: (v) => (v as number) > 10 }).pass).toBe(true));
    it('fails when fn returns false', () =>
      expect(run(AssertOp.Custom, 'age', undefined, { customFn: (v) => (v as number) > 100 }).pass).toBe(false));
  });

  describe('nested path', () => {
    it('resolves dot-separated paths', () =>
      expect(run(AssertOp.Eq, 'address.city', 'Shanghai').pass).toBe(true));
  });

  describe('result shape', () => {
    it('returns instanceId and description', () => {
      const result = executeAssertions(obj, [{ path: 'age', op: AssertOp.Eq, value: 30 }], 'MyService#0', 'my desc');
      expect(result.instanceId).toBe('MyService#0');
      expect(result.description).toBe('my desc');
    });

    it('pass is false if any assertion fails', () => {
      const result = executeAssertions(
        obj,
        [
          { path: 'age', op: AssertOp.Eq, value: 30 },
          { path: 'name', op: AssertOp.Eq, value: 'Bob' },
        ],
        'test#0'
      );
      expect(result.pass).toBe(false);
      expect(result.results[0].pass).toBe(true);
      expect(result.results[1].pass).toBe(false);
    });
  });
});

describe('RSAssertionError', () => {
  it('is thrown-like with result attached', () => {
    const result = executeAssertions(obj, [{ path: 'name', op: AssertOp.Eq, value: 'Bob' }], 'test#0');
    const err = new RSAssertionError(result);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RSAssertionError');
    expect(err.result).toBe(result);
    expect(err.message).toContain('test#0');
  });
});
