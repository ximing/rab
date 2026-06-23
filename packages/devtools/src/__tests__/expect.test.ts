import { RSAssertionError } from '../assert/assertions';
import { RSExpectBuilder, rsExpect } from '../assert/expect';

const instance = { count: 5, name: 'test', items: [1, 2, 3] };

function builder() {
  return new RSExpectBuilder('TestService#0', () => instance);
}

describe('RSExpectBuilder', () => {
  describe('run()', () => {
    it('returns pass:true when all assertions pass', () => {
      const result = builder().toBe('count', 5).toExist('name').run();
      expect(result.pass).toBe(true);
      expect(result.instanceId).toBe('TestService#0');
    });

    it('returns pass:false when an assertion fails', () => {
      const result = builder().toBe('count', 99).run();
      expect(result.pass).toBe(false);
    });

    it('attaches description when describe() is called', () => {
      const result = builder().describe('check count').toBe('count', 5).run();
      expect(result.description).toBe('check count');
    });
  });

  describe('expect()', () => {
    it('does not throw when assertions pass', () => {
      expect(() => builder().toBe('count', 5).expect()).not.toThrow();
    });

    it('throws RSAssertionError when assertions fail', () => {
      expect(() => builder().toBe('count', 99).expect()).toThrow(RSAssertionError);
    });
  });

  describe('check()', () => {
    it('returns true when assertions pass', () => {
      const result = builder().toExist('count').check();
      expect(result).toBe(true);
    });

    it('returns false when assertions fail', () => {
      const result = builder().toBe('count', 0).check();
      expect(result).toBe(false);
    });
  });

  describe('fluent chain', () => {
    it('chains multiple assertions', () => {
      const result = builder()
        .toExist('count')
        .toBeGreaterThan('count', 0)
        .toHaveLength('items', 3)
        .toInclude('items', 2)
        .run();
      expect(result.pass).toBe(true);
    });

    it('all assertion methods return this', () => {
      const b = builder();
      expect(b.toBe('x', 1)).toBe(b);
      expect(b.notToBe('x', 2)).toBe(b);
      expect(b.toExist('x')).toBe(b);
      expect(b.toNotExist('missing')).toBe(b);
      expect(b.toBeGreaterThan('count', 0)).toBe(b);
      expect(b.toBeGreaterThanOrEqual('count', 5)).toBe(b);
      expect(b.toBeLessThan('count', 100)).toBe(b);
      expect(b.toBeLessThanOrEqual('count', 5)).toBe(b);
      expect(b.toBeBetween('count', 1, 10)).toBe(b);
      expect(b.toMatch('name', /test/)).toBe(b);
      expect(b.toBeType('count', 'number')).toBe(b);
      expect(b.toHaveLength('items', 3)).toBe(b);
      expect(b.toHaveLengthGt('items', 2)).toBe(b);
      expect(b.toHaveLengthGte('items', 3)).toBe(b);
      expect(b.toHaveLengthLt('items', 10)).toBe(b);
      expect(b.toHaveLengthLte('items', 3)).toBe(b);
      expect(b.toDeepEqual('items', [1, 2, 3])).toBe(b);
      expect(b.describe('desc')).toBe(b);
    });
  });
});

describe('rsExpect', () => {
  it('builds assertions against a direct instance', () => {
    const result = rsExpect(instance).toBe('count', 5).run();
    expect(result.pass).toBe(true);
    expect(result.instanceId).toBe('(direct)');
  });

  it('accepts an optional description', () => {
    const result = rsExpect(instance, 'my check').run();
    expect(result.description).toBe('my check');
  });
});
