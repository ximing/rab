/*
 * 加固测试 (GG3 regression lens): 固化 G3 修复 (5f9b19f) 中未被
 * compare-and-guards.test.ts 覆盖到的正确行为。
 *
 * 这些用例当前全部通过 —— 目的是防止后续 G4-G8 批次改坏:
 * - defineProperty 数据描述符路径的 Object.is 语义 (NaN 连定义不通知);
 * - 失败 defineProperty (frozen) 不通知;
 * - sealed / frozen 数组的失败删除不通知 (含 ITERATION_KEY 依赖);
 * - setter-only accessor 重定义为 getter 的通知。
 */
import { observable, observe } from "../main";

describe("GG3 hardening: defineProperty Object.is 数据描述符路径", () => {
  test("同值 NaN 重定义不通知, 变值定义要通知", () => {
    const obj = observable<{ x: number }>({ x: NaN });
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([NaN]);

    Object.defineProperty(obj, "x", { value: NaN, configurable: true });
    expect(seen.length).toBe(1);

    Object.defineProperty(obj, "x", { value: 1, configurable: true });
    expect(seen).toEqual([NaN, 1]);
  });

  test("失败的 defineProperty (frozen) 不通知且返回 false", () => {
    const obj = observable<{ x: number }>({ x: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    Object.freeze(obj);

    expect(Reflect.defineProperty(obj, "x", { value: 5 })).toBe(false);
    expect(seen).toEqual([1]);
    expect(obj.x).toBe(1);
  });
});

describe("GG3 hardening: 失败删除的守卫边界", () => {
  test("sealed 对象删除不可配置属性失败不通知", () => {
    const obj = observable<{ x: number }>({ x: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    Object.seal(obj);

    expect(Reflect.deleteProperty(obj, "x")).toBe(false);
    expect(seen).toEqual([1]);
    expect(obj.x).toBe(1);
  });

  test("frozen 删除失败不得通知 ITERATION_KEY (键集合) 依赖", () => {
    const obj = observable<{ a: number }>({ a: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(obj).length);
    });
    expect(seen).toEqual([1]);
    Object.freeze(obj);

    expect(Reflect.deleteProperty(obj, "a")).toBe(false);
    expect(seen).toEqual([1]);
    expect(Object.keys(obj)).toEqual(["a"]);
  });

  test("frozen 数组索引删除失败不通知", () => {
    const arr = observable([1, 2, 3]);
    const seen: number[] = [];
    observe(() => {
      seen.push(arr[1]);
    });
    Object.freeze(arr);

    expect(Reflect.deleteProperty(arr, 1)).toBe(false);
    expect(seen).toEqual([2]);
    expect(arr[1]).toBe(2);
  });
});

describe("GG3 hardening: accessor 种类翻转边界", () => {
  test("setter-only accessor 重定义为 getter 要通知", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "x", {
      set() {
        /* setter-only: 读取返回 undefined */
      },
      configurable: true,
    });
    const obj = observable(raw);
    const seen: unknown[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([undefined]);

    Object.defineProperty(obj, "x", { get: () => 42, configurable: true });
    expect(seen).toEqual([undefined, 42]);
  });
});
