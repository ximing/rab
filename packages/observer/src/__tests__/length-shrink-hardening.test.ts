/*
 * 对抗审查加固测试 (GG1): G1 length 收缩修复的回归面。
 * 覆盖任务书之外、但同属收缩通知语义的场景:
 * - defineProperty 字符串值收缩
 * - 连续收缩
 * - pop/splice 引擎内部走 trap 的收缩
 * - shadow observable 数组收缩
 * - unobserve 后收缩不复活 reaction
 * - 收缩后再增长+回填, 读洞依赖在回填时被通知
 * */
import { observable, shadowObservable, observe, unobserve } from "../main";

describe("数组 length 收缩通知加固 (GG1)", () => {
  test("Object.defineProperty(arr, 'length', {value: '2'}) 字符串值收缩应通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    Object.defineProperty(arr, "length", { value: "2" });
    expect(arr.length).toBe(2);
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("连续收缩 (5→4→2) 读 arr[3] 只在实际删除时通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[3];
    });
    arr.length = 4; // arr[3] 未受影响, 不应通知
    expect(runs).toBe(1);
    expect(last).toBe(4);
    arr.length = 2; // arr[3] 被隐式删除, 应通知
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("pop 引擎内部走 trap 收缩 length, 读被删索引的 reaction 应被通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    arr.pop();
    // 注: 当前 delete trap 与 length 收缩分支会对同一 key 各通知一次
    // (既有行为, 非本修复引入), 这里只断言"确实被通知且读到新值"
    expect(runs).toBeGreaterThan(1);
    expect(last).toBeUndefined();
  });

  test("splice 删除中间元素后, 读尾部旧索引的 reaction 应被通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    arr.splice(1, 1); // length 5→4, 原 arr[4] 的值前移, 旧尾索引变洞
    expect(runs).toBeGreaterThan(1);
    expect(last).toBeUndefined();
  });

  test("shadow observable 数组收缩应通知非边界索引依赖", () => {
    const arr = shadowObservable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("unobserve 后收缩不应复活 reaction", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    const reaction = observe(() => {
      runs++;
      void arr[4];
    });
    unobserve(reaction);
    arr.length = 3;
    expect(runs).toBe(1);
  });

  test("收缩→增长→回填: 读洞依赖在回填时被通知为新值", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
    arr.length = 5; // 增长不误报, arr[4] 仍是洞
    expect(runs).toBe(2);
    arr[4] = 99; // 回填是 add, 应通知
    expect(runs).toBe(3);
    expect(last).toBe(99);
  });

  test("收缩触发的 reaction 内再收缩另一个数组 (嵌套通知)", () => {
    const arrA = observable([1, 2, 3, 4, 5]);
    const arrB = observable([10, 20, 30, 40, 50]);
    let bRuns = 0;
    let bLast: unknown = "initial";
    observe(() => {
      bRuns++;
      bLast = arrB[3];
    });
    let aRuns = 0;
    observe(() => {
      aRuns++;
      void arrA[4];
      if (aRuns === 2) {
        arrB.length = 2;
      }
    });
    arrA.length = 3;
    expect(aRuns).toBe(2);
    expect(bRuns).toBe(2);
    expect(bLast).toBeUndefined();
  });
});
