/*
 * 回归测试: shadowObservable 集合代理对未知 key 的 fallback
 *
 * 背景 bug: createShadowCollectionProxyHandlers 对不在 shadowCollectionHandlers
 * 里的 key 一律返回 undefined, 导致 map.constructor / map.toString 等全部丢失,
 * String(map) 直接抛 TypeError: Cannot convert object to primitive value,
 * console.log / 序列化 / duck-typing 检测全挂。
 */
import { shadowObservable } from "../main";

describe("shadowObservable 集合 unknown-key fallback", () => {
  test("constructor 应保持原生语义", () => {
    const map = shadowObservable(new Map([["a", 1]]));
    expect(map.constructor).toBe(Map);
    const set = shadowObservable(new Set([1]));
    expect(set.constructor).toBe(Set);
  });

  test("String(map) 不应抛错 (toString 可用)", () => {
    const map = shadowObservable(new Map([["a", 1]]));
    expect(() => String(map)).not.toThrow();
    expect(typeof String(map)).toBe("string");
  });

  test("原型链方法不可枚举地保持可用 (duck-typing 检测)", () => {
    const set = shadowObservable(new Set([1]));
    // 常见 duck-typing: 检测 size + add/delete 的存在性
    expect(typeof (set as unknown as { add: unknown }).add).toBe("function");
    expect((set as unknown as { size: number }).size).toBe(1);
  });

  test("非方法的原型属性返回原生值", () => {
    const map = shadowObservable(new Map());
    // Map.prototype 没有数据属性, 但 Symbol.toStringTag 在原型上
    expect((map as unknown as Record<symbol, unknown>)[Symbol.toStringTag]).toBe(
      "Map"
    );
  });

  test("数值/字符串等不相关 key 不再制造假象 (保持 undefined)", () => {
    const map = shadowObservable(new Map());
    // 不存在的属性仍然是 undefined (与普通对象语义一致)
    expect((map as unknown as Record<string, unknown>).notExist).toBeUndefined();
  });

  test("响应式行为保持正常 (不因 fallback 破坏)", () => {
    const map = shadowObservable(new Map<number, number>());
    (map as unknown as { set: (k: number, v: number) => void }).set(1, 1);
    expect((map as unknown as { get: (k: number) => number }).get(1)).toBe(1);
    expect((map as unknown as { size: number }).size).toBe(1);
  });
});
