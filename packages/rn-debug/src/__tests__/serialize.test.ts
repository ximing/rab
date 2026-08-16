import { safeSerialize } from '../serialize';

describe('safeSerialize', () => {
  it('普通对象/数组/原样返回基础类型', () => {
    expect(safeSerialize({ a: 1, b: 'x', c: true, d: null })).toEqual({
      ok: true,
      data: { a: 1, b: 'x', c: true, d: null },
    });
    expect(safeSerialize([1, 'a'])).toEqual({ ok: true, data: [1, 'a'] });
    expect(safeSerialize(42)).toEqual({ ok: true, data: 42 });
  });

  it('移除函数与 undefined 字段', () => {
    const r = safeSerialize({ a: 1, fn: () => 1, u: undefined });
    expect(r).toEqual({ ok: true, data: { a: 1 } });
  });

  it('循环引用被切断不抛错', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const r = safeSerialize(obj);
    expect(r.ok).toBe(true);
    expect(() => JSON.stringify(r.ok ? r.data : null)).not.toThrow();
  });

  it('深度超过 6 层截断', () => {
    const deep = { a: { a: { a: { a: { a: { a: { a: { a: 1 } } } } } } } };
    const r = safeSerialize(deep) as { ok: boolean; data: unknown };
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.data)).not.toContain('"a":1');
    expect(JSON.stringify(r.data)).toContain('[Truncated]');
  });
});
