/*
 * 对抗审查加固测试 (GG1 第 2 轮): 收缩分支新守卫的区分性行为。
 * 这些用例在旧实现 (typeof operation.value === "number" 近似方案) 下会失败:
 * - 旧实现进入收缩分支只看赋值值, 不确认"确实发生了收缩",
 *   对 frozen 数组的失败写入会假通知被截断索引;
 * - has-trap 依赖 (`4 in arr`) 挂在 "4" 键下, 只有正确的收缩区间计算才能通知到。
 */
import { observable, observe } from "../main";

describe("数组 length 收缩通知 (对抗加固第 2 轮)", () => {
  test("has-trap 依赖 (4 in arr) 在收缩时应被通知为 false", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = 4 in arr;
    });
    expect(runs).toBe(1);
    expect(last).toBe(true);
    arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBe(false);
  });

  test("frozen 数组失败写入: 不因 typeof value === 'number' 假通知被截断索引", () => {
    const arr = observable(Object.freeze([1, 2, 3, 4, 5]));
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    // frozen 数组收缩必然失败 (元素不可配置), length 保持 5
    Reflect.set(arr, "length", 3);
    expect(arr.length).toBe(5);
    expect(runs).toBe(1);
    expect(last).toBe(5);
  });

  test("sealed 数组无法收缩 (元素不可配置): 不通知、length 不变", () => {
    const raw = [1, 2, 3, 4, 5];
    Object.seal(raw);
    const arr = observable(raw);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    Reflect.set(arr, "length", 3);
    expect(arr.length).toBe(5);
    expect(runs).toBe(1);
    expect(last).toBe(5);
  });

  test("收缩窗口之外的索引依赖不通知 (索引 100 使 length=101, 收缩 6→3 恰好删除它)", () => {
    const raw = [1, 2, 3, 4, 5];
    Object.defineProperty(raw, "100", {
      value: "hundred",
      configurable: true,
      writable: true,
    });
    const arr = observable(raw);
    expect(arr.length).toBe(101);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[100];
    });
    arr.length = 6; // 101→6, 索引 100 被删除 → 应通知
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
    arr.length = 6; // no-op, 不再通知
    expect(runs).toBe(2);
  });

  test("普通对象带数值 length (duck-typed): 索引属性不受影响、不通知", () => {
    const obj = observable({
      length: 5,
      0: "a",
      1: "b",
      2: "c",
      3: "d",
      4: "e",
    });
    let idxRuns = 0;
    let idxLast: unknown = "initial";
    let lenRuns = 0;
    observe(() => {
      idxRuns++;
      idxLast = obj[4];
    });
    observe(() => {
      lenRuns++;
      void obj.length;
    });
    obj.length = 3; // 普通对象不会删除索引属性
    expect(idxRuns).toBe(1);
    expect(idxLast).toBe("e");
    expect(lenRuns).toBe(2);
  });
});
