/*
 * set trap 写入精度测试 (G1 第 2 轮对抗审查 issue #1):
 * - Reflect.set 返回 false (写入未生效, 如 sealed/frozen target) 时不得发通知
 * - 数组 length 赋值必须用折叠后的 target.length 与旧值比较,
 *   原始赋值值可能是字符串 ('5'), 直接比较 '5' !== 5 会同值假通知
 * - 同样的折叠比较也要覆盖 defineProperty 的 length 路径
 * - 正向对照: 真实发生的类型化收缩/增长仍必须通知 (不能因精度修复而漏报)
 * */
import { observable, shadowObservable, observe } from "../main";

describe("set trap 写入精度: 失败写入不通知", () => {
  test("sealed 数组上失败的 length 收缩不通知 length 依赖", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    Object.seal(arr);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    expect(runs).toBe(1);
    const ok = Reflect.set(arr, "length", 3);
    expect(ok).toBe(false);
    expect(arr.length).toBe(5); // 收缩未发生
    expect(runs).toBe(1); // 不应假通知
  });

  test("sealed 数组上失败的 length 收缩不通知索引依赖", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    Object.seal(arr);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    expect(Reflect.set(arr, "length", 3)).toBe(false);
    expect(runs).toBe(1);
    expect(last).toBe(5);
  });

  test("sealed shadow 数组上失败的 length 收缩不通知 length 依赖", () => {
    const arr = shadowObservable([1, 2, 3, 4, 5]);
    Object.seal(arr);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    expect(Reflect.set(arr, "length", 3)).toBe(false);
    expect(arr.length).toBe(5);
    expect(runs).toBe(1);
  });

  test("frozen 对象上失败的属性写入不通知该属性依赖", () => {
    const obj = observable({ x: 1 });
    Object.freeze(obj);
    let runs = 0;
    observe(() => {
      void obj.x;
      runs++;
    });
    expect(runs).toBe(1);
    const ok = Reflect.set(obj, "x", 2);
    expect(ok).toBe(false);
    expect(obj.x).toBe(1);
    expect(runs).toBe(1);
  });

  test("sealed 数组上失败的 Object.defineProperty length 收缩不通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    Object.seal(arr);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    // length 在 sealed 数组上不可配置, 收缩需要隐式删除元素 → 定义失败;
    // strict mode 下引擎直接抛 TypeError (即使不抛, trap 也应返回 false)
    expect(() => Object.defineProperty(arr, "length", { value: 3 })).toThrow(
      TypeError
    );
    expect(arr.length).toBe(5);
    expect(runs).toBe(1);
  });
});

describe("set trap 写入精度: 数组 length 折叠比较", () => {
  test("同值异型写入 arr.length = '5' (length 已是 5) 不通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    expect(runs).toBe(1);
    expect(Reflect.set(arr, "length", "5")).toBe(true);
    expect(arr.length).toBe(5);
    expect(runs).toBe(1);
  });

  test("shadow 数组同值异型写入 '5' 不通知", () => {
    const arr = shadowObservable([1, 2, 3, 4, 5]);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    expect(Reflect.set(arr, "length", "5")).toBe(true);
    expect(runs).toBe(1);
  });

  test("同值数值写入 arr.length = 5 不通知 (既有行为回归钉)", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    arr.length = 5;
    expect(runs).toBe(1);
  });

  test("Object.defineProperty(arr, 'length', {value: '5'}) 同值不通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    Object.defineProperty(arr, "length", { value: "5" });
    expect(arr.length).toBe(5);
    expect(runs).toBe(1);
  });

  test("Object.defineProperty shadow 数组同值异型 '5' 不通知", () => {
    const arr = shadowObservable([1, 2, 3, 4, 5]);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    Object.defineProperty(arr, "length", { value: "5" });
    expect(runs).toBe(1);
  });
});

describe("set trap 写入精度: 正向对照 (真实变化仍通知)", () => {
  test("类型化收缩 arr.length = '3' 通知 length 与索引依赖", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let lenRuns = 0;
    let idxRuns = 0;
    let lastIdx: unknown = "initial";
    observe(() => {
      void arr.length;
      lenRuns++;
    });
    observe(() => {
      idxRuns++;
      lastIdx = arr[4];
    });
    expect(Reflect.set(arr, "length", "3")).toBe(true);
    expect(arr.length).toBe(3);
    expect(lenRuns).toBe(2);
    expect(idxRuns).toBe(2);
    expect(lastIdx).toBeUndefined();
  });

  test("类型化增长 arr.length = '7' 通知 length 依赖", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    expect(Reflect.set(arr, "length", "7")).toBe(true);
    expect(arr.length).toBe(7);
    expect(runs).toBe(2);
  });

  test("Object.defineProperty 类型化收缩 {value: '3'} 通知索引依赖", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = "initial";
    observe(() => {
      runs++;
      last = arr[4];
    });
    Object.defineProperty(arr, "length", { value: "3" });
    expect(arr.length).toBe(3);
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("数值收缩失败后真实收缩仍正常通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    observe(() => {
      void arr.length;
      runs++;
    });
    Reflect.set(arr, "length", 5); // 同值, 不通知
    expect(runs).toBe(1);
    arr.length = 3; // 真实收缩, 通知
    expect(runs).toBe(2);
  });
});
