/*
 * 回归测试: 数组 length 收缩时必须用 trap 捕获的旧 length (operation.oldValue)
 * 计算被隐式删除的索引区间, 而不是用赋值后的 target.length 近似。
 *
 * 背景 bug:
 * getReactionsForOperation 的收缩分支用 target.length + 1 近似旧 length,
 * 但通知发生在赋值之后, target.length 已是新值 —— 只有边界索引 (newLength)
 * 恰好落入 [newLength, target.length+1) 区间被通知, 读非边界索引
 * (如 5→3 时读 arr[4]) 的 reaction 漏通知, 读到脏数据。
 *
 * 注意: 断言使用执行次数/严格相等而不是 toEqual([5, undefined]) ——
 * jest 的 toEqual 会忽略尾部 undefined 元素, [5] 与 [5, undefined] 视为相等,
 * 无法证明 reaction 真的被触发。
 */
import { observable, observe } from "../main";

describe("数组 length 收缩通知 (oldValue 修复)", () => {
  test("收缩到中间值时读非边界索引 (5→3 读 arr[4]) 应被通知为 undefined", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    expect(runs).toBe(1);
    expect(last).toBe(5);
    arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("收缩到 0 时读 arr[0] 应被通知为 undefined", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[0];
    });
    arr.length = 0;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("收缩到 0 时读中间索引 (arr[2]) 应被通知为 undefined", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[2];
    });
    arr.length = 0;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test('arr.length = "3" (字符串) 收缩仍应通知非边界索引依赖', () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    // TS 类型层面 length 是 number, 用 Reflect.set 绕过以测试运行时字符串赋值
    Reflect.set(arr, "length", "3");
    expect(arr.length).toBe(3);
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("Object.defineProperty(arr, 'length', {value: 2}) 收缩路径应通知非边界索引", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    Object.defineProperty(arr, "length", { value: 2 });
    expect(arr.length).toBe(2);
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("length 增长不应错误通知现有索引依赖 (回归)", () => {
    const arr = observable([1, 2]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[0];
    });
    expect(runs).toBe(1);
    arr.length = 10;
    expect(runs).toBe(1);
    expect(last).toBe(1);
  });

  test("length 收缩时依赖 length 本身的 reaction 仍被通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last = 0;
    observe(() => {
      runs++;
      last = arr.length;
    });
    arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBe(3);
  });
});
