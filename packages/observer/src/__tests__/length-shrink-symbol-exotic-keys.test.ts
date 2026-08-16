/*
 * 对抗审查第 1 轮回归: addReactionsForTruncatedArrayKeys 的 key 匹配
 * 必须对 ConnectionMap 里可能出现的所有 key 形态安全:
 *
 * 1. 自定义 symbol 依赖 (get trap 对非 well-known symbol 会注册依赖):
 *    数组 length 收缩时遍历该数组的依赖 key 并做 Number(key) —— 对 symbol
 *    直接抛 "Cannot convert a Symbol value to a number", 用户的一句
 *    arr.length = 3 就能触发崩溃。symbol 不是数组索引, 应直接跳过。
 *
 * 2. 奇异字符串 key (如 "03"): Number("03") === 3 是整数, 但 "03" 不是
 *    canonical 数组索引 —— arr["03"] 是永远读到 undefined 的普通属性,
 *    length 收缩不影响它的值。把它误匹配为被截断索引会产生与自身值无关
 *    的假通知。匹配前必须校验 key 是 canonical index。
 */
import { observable, observe, shadowObservable } from "../main";

describe("数组 length 收缩: symbol / 奇异 key 的安全与精确匹配", () => {
  test("自定义 symbol key 依赖 + 数值收缩不应抛 TypeError", () => {
    const s = Symbol("custom");
    const arr = observable([1, 2, 3, 4, 5]) as any;
    let runs = 0;
    observe(() => {
      runs++;
      void arr[s];
    });
    expect(runs).toBe(1);
    expect(() => {
      arr.length = 3;
    }).not.toThrow();
    expect(arr.length).toBe(3);
    // symbol 依赖与索引截断无关, 不应被额外通知
    expect(runs).toBe(1);
  });

  test("自定义 symbol key 依赖 + 字符串收缩 (Reflect.set '3') 不应抛 TypeError", () => {
    const s = Symbol("custom");
    const arr = observable([1, 2, 3, 4, 5]) as any;
    let runs = 0;
    observe(() => {
      runs++;
      void arr[s];
    });
    expect(() => {
      Reflect.set(arr, "length", "3");
    }).not.toThrow();
    expect(arr.length).toBe(3);
    expect(runs).toBe(1);
  });

  test("自定义 symbol key 依赖 + defineProperty 收缩不应抛 TypeError", () => {
    const s = Symbol("custom");
    const arr = observable([1, 2, 3, 4, 5]) as any;
    let runs = 0;
    observe(() => {
      runs++;
      void arr[s];
    });
    expect(() => {
      Object.defineProperty(arr, "length", { value: 2 });
    }).not.toThrow();
    expect(arr.length).toBe(2);
    expect(runs).toBe(1);
  });

  test("shadowObservable 数组: symbol key 依赖 + 收缩不应抛 TypeError", () => {
    const s = Symbol("custom");
    const arr = shadowObservable([1, 2, 3, 4, 5]) as any;
    let runs = 0;
    observe(() => {
      runs++;
      void arr[s];
    });
    expect(() => {
      arr.length = 3;
    }).not.toThrow();
    expect(arr.length).toBe(3);
    expect(runs).toBe(1);
  });

  test("symbol 依赖与真实索引依赖共存时: 不抛错且索引依赖仍被正确通知", () => {
    const s = Symbol("custom");
    const arr = observable([1, 2, 3, 4, 5]) as any;
    let symRuns = 0;
    let idxRuns = 0;
    let idxLast: unknown = "initial";
    observe(() => {
      symRuns++;
      void arr[s];
    });
    observe(() => {
      idxRuns++;
      idxLast = arr[4];
    });
    arr.length = 3;
    expect(symRuns).toBe(1);
    expect(idxRuns).toBe(2);
    expect(idxLast).toBeUndefined();
  });

  test('奇异字符串 key "03" 不是数组索引: 收缩不应通知它', () => {
    const arr = observable([1, 2, 3, 4, 5]) as any;
    let runs = 0;
    observe(() => {
      runs++;
      void arr["03"]; // Number("03") === 3, 但 arr["03"] 是普通属性, 恒为 undefined
    });
    expect(runs).toBe(1);
    arr.length = 2;
    // arr["03"] 的值没有变化 (仍是 undefined), 不应收到与自身值无关的通知
    expect(runs).toBe(1);
  });

  test("canonical 字符串索引 key (如 '4') 仍应被收缩通知 (回归)", () => {
    const arr = observable([1, 2, 3, 4, 5]) as any;
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr["4"];
    });
    arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });
});
