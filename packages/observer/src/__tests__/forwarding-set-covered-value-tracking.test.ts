/*
 * 回归测试 (对抗审查第 4 轮, G2b 修复的第 1 轮审查 #1/#2/#3):
 *
 * covered 布尔只表达「本帧通知责任已被嵌套写入的通知替代」, 但同一转发窗口内
 * 后续仍可能发生新的同 key 落盘 —— 嵌套 set 通知 (3→7) 之后, setter 又对同一
 * {target, key} 显式 defineProperty 改值 (7→9) / 重定义 accessor / 写入起点
 * 落在被改层自身 (根帧 landed 分支)。此时:
 * - defineProperty trap 命中已 covered 的帧被透传 (不通知);
 * - 外层帧的 receiver-mismatch 通知 / 根帧的兜底 add / landed 分支通知又被
 *   covered 抑制 → 7→9 的落盘变化无人通知, reaction 永久停留在中间值 7。
 *
 * 期望: covered 的语义必须携带「已通知值」—— 落盘值与已通知值一致时才跳过
 * (G2b 的单通知语义不变); 不一致时按差值补发通知, reaction 最终观察到 9。
 *
 * 复现脚本: /tmp/gg2b-attack-define-after-nested.ts, /tmp/gg2b-attack-variants.ts,
 * /tmp/gg2b-reg-sequential-writes.ts, /tmp/gg2b-reg-shadow-seq.ts,
 * /tmp/gg2b-reg-accessor.ts, /tmp/gg2b-attack-root-on-middle.ts
 */
import { observable, observe, shadowObservable } from "../main";

type Make = (o: object) => Record<PropertyKey, unknown>;

const dataDescriptor = (v: unknown): PropertyDescriptor => ({
  value: v,
  writable: true,
  enumerable: true,
  configurable: true,
});

/*
 * G2b 链: child → middle → gp (gp.k 是 accessor setter)。
 * setter 依次: defineProperty(middle,'k',3) → 嵌套普通赋值 middle.k=7 →
 * 再对同 key 做一次新的落盘 (由 after 回调给出)。
 * 写入起点默认是 child (外层 middle 帧走 receiver-mismatch 分支)。
 */
function setupChain(
  makeMiddle: Make,
  makeChild: Make,
  after: (middle: Record<PropertyKey, unknown>) => void,
  writeStart: "child" | "middle" = "child"
) {
  const middle = makeMiddle({ side: 0 });
  const gpRaw: Record<PropertyKey, unknown> = {};
  Object.defineProperty(gpRaw, "k", {
    configurable: true,
    set(_v: number) {
      Object.defineProperty(middle, "k", dataDescriptor(3));
      // 嵌套普通赋值: normal-path 落盘通知 3→7,
      // markNotifiedInFlightFrames 把外层 middle 帧与链根帧标记 covered
      middle.k = 7;
      // 关键攻击点: covered 之后再做一次同 key 落盘
      after(middle);
    },
  });
  const gp = observable(gpRaw);
  Object.setPrototypeOf(middle, gp);
  const child = makeChild(Object.create(middle));

  const seen: unknown[] = [];
  let midCalls = 0;
  observe(() => {
    seen.push(middle.k);
    midCalls++;
  });
  const childSeen: unknown[] = [];
  observe(() => {
    childSeen.push(child.k);
  });

  if (writeStart === "child") {
    child.k = 5;
  } else {
    middle.k = 5;
  }
  return { middle, child, seen, midCalls, childSeen };
}

describe("转发帧 covered 值追踪: 嵌套 set 通知后的同 key 新落盘不得丢通知", () => {
  test("base: 嵌套 set (→7) 后同 key defineProperty(9), reaction 观察到 7→9", () => {
    const { middle, seen, midCalls, childSeen } = setupChain(
      observable,
      observable,
      (m) => {
        Object.defineProperty(m, "k", dataDescriptor(9));
      }
    );
    expect(middle.k).toBe(9);
    expect(seen).toEqual([undefined, 7, 9]);
    expect(midCalls).toBe(3);
    // 链根 (child) reaction 依赖 {childRaw,k} 与 {middleRaw,k} 两层,
    // 两次落盘通知都必须到达, 不得停留在中间值
    expect(childSeen[childSeen.length - 1]).toBe(9);
  });

  test("shadow 中层: 同场景不丢通知", () => {
    const { middle, seen } = setupChain(
      shadowObservable,
      observable,
      (m) => {
        Object.defineProperty(m, "k", dataDescriptor(8));
      }
    );
    expect(middle.k).toBe(8);
    expect(seen).toEqual([undefined, 7, 8]);
  });

  test("混合链 (shadow child + base middle): 同场景不丢通知", () => {
    const { middle, seen } = setupChain(
      observable,
      shadowObservable,
      (m) => {
        Object.defineProperty(m, "k", dataDescriptor(9));
      }
    );
    expect(middle.k).toBe(9);
    expect(seen).toEqual([undefined, 7, 9]);
  });

  test("accessor 重定义: 嵌套 set (→7) 后 defineProperty(getter→9), 读取语义变化必须通知", () => {
    const { middle, seen } = setupChain(
      observable,
      observable,
      (m) => {
        Object.defineProperty(m, "k", {
          get() {
            return 9;
          },
          configurable: true,
          enumerable: true,
        });
      }
    );
    expect(middle.k).toBe(9);
    expect(seen).toEqual([undefined, 7, 9]);
  });

  test("对照: covered 后同值 defineProperty (7→7) 仍只通知一次 (G2b 语义保持)", () => {
    const { middle, seen, midCalls } = setupChain(
      observable,
      observable,
      (m) => {
        Object.defineProperty(m, "k", dataDescriptor(7));
      }
    );
    expect(middle.k).toBe(7);
    expect(seen).toEqual([undefined, 7]);
    expect(midCalls).toBe(2);
  });

  test("对照: 嵌套 set 后再一次普通嵌套 set (→9) 逐次通知 (既有行为保持)", () => {
    const { middle, seen } = setupChain(
      observable,
      observable,
      (m) => {
        m.k = 9;
      }
    );
    expect(middle.k).toBe(9);
    expect(seen).toEqual([undefined, 7, 9]);
  });
});

describe("转发帧 covered 值追踪: 根帧 landed 分支 (写入起点在被改层自身)", () => {
  test("base: 写入起点是 middle 自身, 嵌套 set 通知后 landed-add 不得再发一次 (单通知)", () => {
    const { middle, seen, midCalls } = setupChain(
      observable,
      observable,
      () => {
        /* covered 后没有新落盘 */
      },
      "middle"
    );
    expect(middle.k).toBe(7);
    expect(seen).toEqual([undefined, 7]);
    expect(midCalls).toBe(2);
  });

  test("shadow: 写入起点是 middle 自身同样单通知", () => {
    const { middle, seen, midCalls } = setupChain(
      shadowObservable,
      shadowObservable,
      () => {
        /* covered 后没有新落盘 */
      },
      "middle"
    );
    expect(middle.k).toBe(7);
    expect(seen).toEqual([undefined, 7]);
    expect(midCalls).toBe(2);
  });

  test("base: 写入起点是 middle 自身 + covered 后 defineProperty(9), 差值必须通知", () => {
    const { middle, seen } = setupChain(
      observable,
      observable,
      (m) => {
        Object.defineProperty(m, "k", dataDescriptor(9));
      },
      "middle"
    );
    expect(middle.k).toBe(9);
    expect(seen).toEqual([undefined, 7, 9]);
  });
});

describe("转发帧 covered 值追踪: covered 抑制不得吞掉键集合变化的迭代通知", () => {
  // 窗口内新增到 middle 的 key 'k' 改变了键集合。covered 机制抑制的是
  // {target,key} 依赖的重复通知, 但 ownKeys (Object.keys) 观察者的依赖挂在
  // ITERATION_KEY 桶上, 嵌套写入的 "set" 通知不会触发它 —— 若 covered
  // 分支整体静默跳过, 迭代观察者会漏掉新键。
  function setupIterObserver(makeMiddle: Make) {
    const middle = makeMiddle({ side: 0 });
    const gpRaw: Record<PropertyKey, unknown> = {};
    Object.defineProperty(gpRaw, "k", {
      configurable: true,
      set(_v: number) {
        Object.defineProperty(middle, "k", dataDescriptor(3));
        middle.k = 7;
      },
    });
    const gp = observable(gpRaw);
    Object.setPrototypeOf(middle, gp);
    let keyCount = -1;
    observe(() => {
      keyCount = Object.keys(middle).length;
    });
    return { middle, keyCountRef: () => keyCount };
  }

  test("base: 写入起点是 middle 自身, Object.keys 观察者看到新键 (根帧 landed 分支)", () => {
    const { middle, keyCountRef } = setupIterObserver(observable);
    expect(keyCountRef()).toBe(1);
    middle.k = 5;
    expect(middle.k).toBe(7);
    expect(keyCountRef()).toBe(2);
  });

  test("shadow: 同场景 Object.keys 观察者看到新键", () => {
    const { middle, keyCountRef } = setupIterObserver(shadowObservable);
    expect(keyCountRef()).toBe(1);
    middle.k = 5;
    expect(middle.k).toBe(7);
    expect(keyCountRef()).toBe(2);
  });

  test("base: 写入起点是 child (mismatch 分支), Object.keys 观察者同样看到新键", () => {
    const middle: Record<string, unknown> = observable({ side: 0 });
    const gpRaw: Record<PropertyKey, unknown> = {};
    Object.defineProperty(gpRaw, "k", {
      configurable: true,
      set(_v: number) {
        Object.defineProperty(middle, "k", dataDescriptor(3));
        middle.k = 7;
      },
    });
    const gp = observable(gpRaw);
    Object.setPrototypeOf(middle, gp);
    const child = observable(Object.create(middle));
    let keyCount = -1;
    observe(() => {
      keyCount = Object.keys(middle).length;
    });
    expect(keyCount).toBe(1);
    child.k = 5;
    expect(middle.k).toBe(7);
    expect(keyCount).toBe(2);
  });
});
