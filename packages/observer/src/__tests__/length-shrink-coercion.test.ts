/*
 * 对抗审查加固测试 (GG1, correctness 镜像): 引擎数值折叠与窗口边界。
 *
 * 全部用例来自 /tmp 下实际跑过的 adversarial repro:
 * - 引擎会把 "3 " / true / null / "-0" / "0x3" 合法折叠为 uint32 长度,
 *   收缩必须按折叠后的实际长度通知被截断索引;
 * - 收缩窗口 [newLength, oldLength) 的两端边界: 下界含 (idx == newLength
 *   被删除, 必须通知), 上界排他 (idx >= oldLength 恒 undefined, 不通知);
 * - 嵌套 observable 对象内的数组、引擎内部收缩 (shift / length--) 路径;
 * - 同值字符串写入 ("5" onto 5) 与失败写入不得假通知索引依赖。
 */
import { observable, observe } from "../main";

function trackShrink(makeArr: () => number[], index: number) {
  const arr = observable(makeArr());
  let runs = 0;
  let last: unknown = "initial";
  observe(() => {
    runs++;
    last = arr[index];
  });
  return { arr, runs: () => runs, last: () => last };
}

describe("数组 length 收缩: 引擎数值折叠与窗口边界 (GG1 加固)", () => {
  test('Reflect.set(arr, "length", "3 ") (尾随空格) 折叠为 3, 通知被截断索引', () => {
    const t = trackShrink(() => [1, 2, 3, 4, 5], 4);
    Reflect.set(t.arr, "length", "3 ");
    expect(t.arr.length).toBe(3);
    expect(t.runs()).toBe(2);
    expect(t.last()).toBeUndefined();
  });

  test('Reflect.set(arr, "length", true) 折叠为 1, 通知被截断索引', () => {
    const t = trackShrink(() => [1, 2, 3, 4, 5], 3);
    Reflect.set(t.arr, "length", true);
    expect(t.arr.length).toBe(1);
    expect(t.runs()).toBe(2);
    expect(t.last()).toBeUndefined();
  });

  test('Reflect.set(arr, "length", "-0") 折叠为 0, 通知被截断索引', () => {
    const t = trackShrink(() => [1, 2, 3], 1);
    Reflect.set(t.arr, "length", "-0");
    expect(t.arr.length).toBe(0);
    expect(t.runs()).toBe(2);
    expect(t.last()).toBeUndefined();
  });

  test("同值字符串写入 (Reflect.set '5' onto 5) 不得通知索引依赖", () => {
    const t = trackShrink(() => [1, 2, 3, 4, 5], 3);
    Reflect.set(t.arr, "length", "5");
    expect(t.arr.length).toBe(5);
    expect(t.runs()).toBe(1);
    expect(t.last()).toBe(4);
  });

  test("窗口下界含边界: 5→4 读 arr[4] (idx == newLength) 通知为 undefined", () => {
    const t = trackShrink(() => [1, 2, 3, 4, 5], 4);
    t.arr.length = 4;
    expect(t.runs()).toBe(2);
    expect(t.last()).toBeUndefined();
  });

  test("窗口上界排他: 3→1 读 arr[3] (idx >= oldLength, 恒 undefined) 不通知", () => {
    const t = trackShrink(() => [1, 2, 3], 3);
    t.arr.length = 1;
    expect(t.runs()).toBe(1);
  });

  test("窗口内下侧: 5→3 读 arr[2] (未删除) 不通知", () => {
    const t = trackShrink(() => [1, 2, 3, 4, 5], 2);
    t.arr.length = 3;
    expect(t.runs()).toBe(1);
    expect(t.last()).toBe(3);
  });

  test("嵌套 observable 对象内的数组: state.arr.length = 3 通知 arr[4] 依赖", () => {
    const state = observable({ arr: [1, 2, 3, 4, 5] });
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = state.arr[4];
    });
    state.arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("shift() 引擎内部收缩: 读尾部旧索引 reaction 被通知为 undefined", () => {
    const t = trackShrink(() => [1, 2, 3, 4, 5], 4);
    t.arr.shift();
    expect(t.runs()).toBeGreaterThanOrEqual(2);
    expect(t.last()).toBeUndefined();
  });

  test("arr.length-- 复合操作收缩: 读被删索引 reaction 被通知为 undefined", () => {
    const t = trackShrink(() => [1, 2, 3, 4, 5], 4);
    t.arr.length--;
    expect(t.runs()).toBe(2);
    expect(t.last()).toBeUndefined();
  });

  test("大稀疏数组 1000→0: 读 arr[999] 依赖被通知为 undefined", () => {
    const arr = observable(new Array(1000));
    (arr as unknown as Record<number, string>)[999] = "x";
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[999];
    });
    arr.length = 0;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });
});
