/*
 * GG1 回归镜头加固测试: length 收缩通知与调度器/数组方法/混合 handler 的交互。
 * 由对抗审查 (回归与兼容镜头) 验证过的行为, 这里固化为回归:
 * - Set 型 scheduler 批量: 一次收缩把窗口内全部索引依赖各入队一次;
 * - pop/splice 等数组方法的收缩路径不丢通知;
 * - base 与 shadow 混合使用时互不干扰;
 * - 收缩触发的 reaction 内再次收缩不破坏后续通知。
 */
import { observable, observe, shadowObservable } from "../main";

describe("length 收缩通知的调度与交互行为", () => {
  test("Set 型 scheduler: 一次收缩把窗口内的索引依赖各入队一次", () => {
    const arr = observable([0, 1, 2, 3, 4, 5]) as number[];
    const queued = new Set<object>();
    const queue = {
      add: (r: object) => queued.add(r),
      has: (r: object) => queued.has(r),
      delete: (r: object) => queued.delete(r),
    };
    observe(() => void arr[2], { scheduler: queue as unknown as Set<unknown> });
    observe(() => void arr[3], { scheduler: queue as unknown as Set<unknown> });
    observe(() => void arr[5], { scheduler: queue as unknown as Set<unknown> });
    queued.clear();
    arr.length = 3;
    // 窗口 [3, 6): idx3 与 idx5 入队; idx2 < newLength 不入队
    expect(queued.size).toBe(2);
    queued.clear();
    arr.length = 1;
    // 窗口 [1, 3): 仅 idx2
    expect(queued.size).toBe(1);
  });

  test("pop 的收缩路径通知被删除索引的依赖并读到 undefined", () => {
    const arr = observable([1, 2, 3, 4, 5]) as number[];
    let last: unknown = "initial";
    let runs = 0;
    observe(() => {
      runs++;
      last = arr[4];
    });
    expect(runs).toBe(1);
    arr.pop();
    expect(arr.length).toBe(4);
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(last).toBeUndefined();
  });

  test("splice 的收缩路径通知被截断索引的依赖", () => {
    const arr = observable([1, 2, 3, 4, 5]) as number[];
    let last: unknown = "initial";
    let runs = 0;
    observe(() => {
      runs++;
      last = arr[3];
    });
    expect(runs).toBe(1);
    arr.splice(1, 2);
    expect(arr.length).toBe(3);
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(last).toBeUndefined();
  });

  test("base 与 shadow 混合使用: 交叉收缩互不干扰", () => {
    const sarr = shadowObservable([1, 2, 3, 4, 5]) as number[];
    const barr = observable({ list: [1, 2, 3, 4, 5] }) as { list: number[] };
    let s = 0;
    let b = 0;
    observe(() => {
      s++;
      void sarr[4];
    });
    observe(() => {
      b++;
      void barr.list[3];
    });
    expect(s).toBe(1);
    expect(b).toBe(1);
    sarr.length = 3;
    barr.list.length = 2;
    expect(sarr.length).toBe(3);
    expect(barr.list.length).toBe(2);
    expect(s).toBe(2);
    expect(b).toBe(2);
  });

  test("收缩触发的 reaction 内再次收缩: 不破坏后续通知", () => {
    const arr = observable([1, 2, 3, 4, 5, 6, 7, 8]) as number[];
    let cascades = 0;
    let armed = false;
    observe(() => {
      cascades++;
      // 注意: arr[6] 必须无条件读取以建立依赖 (短路会漏注册)
      const v6 = arr[6];
      // 被收缩通知后 (arr[6] 变 undefined): 在自身执行内再次收缩 6→4
      if (armed && v6 === undefined && cascades < 5) {
        arr.length = 4;
      }
    });
    let low = 0;
    observe(() => {
      low++;
      void arr[1];
    });
    armed = true;
    arr.length = 6; // 8→6 → 通知 idx6 依赖 → cascades 内部再收缩到 4
    expect(arr.length).toBe(4);
    // 级联 reaction 被通知一次, 内部收缩后因窗口 [4,6) 不含 idx6 不再自我触发
    expect(cascades).toBe(2);
    // 窗口外索引 (idx1) 值未变, 不应被误通知
    expect(low).toBe(1);
  });
});
