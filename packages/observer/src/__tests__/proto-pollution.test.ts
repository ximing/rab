/*
 * 回归测试: observable 不得成为原型污染的入口
 *
 * 背景 bug: get trap 读 '__proto__' 返回 Object.prototype,
 * observableChild 会把 Object.prototype 本身包装成 observable
 * (它的 constructor 是 Object, shouldInstrument 返回 true),
 * 随后的写入落在真实的 Object.prototype 上 —— 全局原型污染。
 * 实测 (修复前): state.__proto__.zzPolluted = 1 之后 ({}).zzPolluted === 1。
 */
import {
  observable,
  shadowObservable,
  observe,
  raw,
  isObservable,
} from "../main";

describe("__proto__ 不得造成原型污染", () => {
  test("读取 __proto__ 不得把 Object.prototype 变成 observable (写入不进入响应式系统)", () => {
    const state = observable<{ count: number }>({ count: 0 });
    const proto = (state as unknown as { __proto__: object }).__proto__;
    // 修复前: proto 是 Object.prototype 的 observable 包装,
    // 对它的写入会经过 set trap 落在真实 Object.prototype 上并被追踪
    expect(isObservable(proto)).toBe(false);
    expect(proto).toBe(Object.prototype);
  });

  test("merge 场景的 __proto__ 赋值被拒绝且不改原型 (防 JSON 注入)", () => {
    const state = observable<{ count: number; [k: string]: unknown }>({
      count: 0,
    });
    // JSON.parse 会把 "__proto__" 解析为自有属性 (spec 豁免),
    // Object.assign 等合并工具通过 [[Set]] 传播 → 不拦截会静默改掉原型。
    // 修复采用 fail-fast: 抛 TypeError 让问题在开发期暴露。
    const malicious = JSON.parse('{"__proto__": {"evil": true}}');
    expect(() => Object.assign(state, malicious)).toThrow(TypeError);

    expect(Object.getPrototypeOf(raw(state))).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
  });

  test("对 __proto__ 赋值应抛错且不改原始对象原型", () => {
    const state = observable<{ count: number }>({ count: 0 });
    const evil = { evil: true };
    expect(
      () => ((state as unknown as { __proto__: object }).__proto__ = evil)
    ).toThrow(TypeError);

    // raw 对象的原型链不应被改变
    expect(Object.getPrototypeOf(raw(state))).toBe(Object.prototype);
    // 全局原型同样不受影响
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
  });

  test("constructor 读取不得返回可被污染的包装对象", () => {
    const state = observable<{ count: number }>({ count: 0 });
    // constructor 是原型链上的敏感属性, 读取结果应保持原生语义
    expect((state as unknown as { constructor: unknown }).constructor).toBe(
      Object
    );
  });

  test("普通继承用法保持正常", () => {
    const parent = observable({ shared: 1 });
    const child = observable(Object.create(parent));
    const seen: unknown[] = [];
    observe(() => {
      seen.push((child as unknown as { shared: number }).shared);
    });
    expect(seen).toEqual([1]);
    (parent as unknown as { shared: number }).shared = 2;
    expect(seen).toEqual([1, 2]);
  });

  test("shadowObservable 同样不包装 __proto__ 且拒绝 __proto__ 赋值", () => {
    const state = shadowObservable<{ [k: string]: unknown }>({ count: 0 });
    const proto = (state as unknown as { __proto__: object }).__proto__;
    expect(isObservable(proto)).toBe(false);
    expect(() => {
      (state as unknown as { __proto__: object }).__proto__ = { evil: true };
    }).toThrow(TypeError);
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
  });
});
