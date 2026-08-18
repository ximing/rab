/*
 * 回归测试 (G2b 修复的第 2 轮对抗审查 #3/#4):
 *
 * 落盘通知分支 (set trap 的 landed-set / landed-add / length) 原先把
 * markNotifiedInFlightFrames 放在 queueReactionsForOperation **之后**。
 * 默认 scheduler 同步执行 reaction —— 若 reaction 在转发窗口内重入写回
 * 同一 in-flight key, 重入 trap 自己的 markNotifiedInFlightFrames 先把
 * 外层帧的 notifiedValue 推进到重入值, 随后外层分支的事后 markNotified
 * 又把它**覆写回过期值**, 造成两类错误:
 *
 * #3 (双通知): 外层 receiver-mismatch 分支判 landed !== 被覆写的 notified
 *   → 对已被通知过的同一终值按差值再补发一次 → 观察者对同一终值跑两次。
 * #4 (丢通知): setter 随后把同 key defineProperty 回旧已通知值,
 *   mismatch 分支判 landed === 被覆写的 notified → 静默跳过 →
 *   观察者永久停留在过期值。
 *
 * 期望 (先标记后通知): 重入写发生时外层帧 notifiedValue 已是嵌套通知值,
 * 重入 trap 事后把它推进到重入值, unwind 时 landed === notified → 正确跳过;
 * setter 再 defineProperty 回旧值时 covered 值 ≠ 落盘值 → 正确补发。
 *
 * 复现脚本: /tmp/rev-g2b-reentry-matrix.ts, /tmp/rev-g2b-lost.ts
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
 * setter: defineProperty(middle,'k',3) → 嵌套普通赋值 middle.k=7
 * (通知 7, 同步 reaction 重入写回 9) → [可选 after 回调再落盘一次]。
 * 观察者 S 记录每次看到的 middle.k; 观察者 W 在首次被 7 通知后写回 9。
 */
function setupReentryChain(
  makeMiddle: Make,
  makeChild: Make,
  writeStart: "child" | "middle",
  after?: (middle: Record<PropertyKey, unknown>) => void
) {
  const middle = makeMiddle({ side: 0 });
  const gpRaw: Record<PropertyKey, unknown> = {};
  Object.defineProperty(gpRaw, "k", {
    configurable: true,
    set(_v: number) {
      Object.defineProperty(middle, "k", dataDescriptor(3));
      // 嵌套通知 7 → 同步 reaction 重入写 9 → 本 trap 落盘分支的事后
      // markNotified(7) 不得把外层帧的 notifiedValue 从 9 覆写回 7
      middle.k = 7;
      after?.(middle);
    },
  });
  const gp = observable(gpRaw);
  Object.setPrototypeOf(middle, gp);
  const child = makeChild(Object.create(middle));

  const midSeen: unknown[] = [];
  observe(() => {
    midSeen.push(middle.k);
  });
  let armed = false;
  let fired = false;
  observe(() => {
    void middle.k;
    if (armed && !fired) {
      fired = true;
      middle.k = 9;
    }
  });

  armed = true;
  if (writeStart === "child") {
    child.k = 5;
  } else {
    middle.k = 5;
  }
  return { middle, child, midSeen };
}

describe("转发帧重入窗口: 重入写回不得让 notifiedValue 被覆写回旧值 (#3 双通知)", () => {
  test.each([
    ["base/base", observable, observable],
    ["shadow-mid/base-child", shadowObservable, observable],
    ["base-mid/shadow-child", observable, shadowObservable],
    ["shadow/shadow", shadowObservable, shadowObservable],
  ] as Array<[string, Make, Make]>)(
    "%s: 写入起点 child, 嵌套通知 7 + 重入写 9 → 单通知语义 [undefined,7,9]",
    (_label, makeMiddle, makeChild) => {
      const { middle, midSeen } = setupReentryChain(
        makeMiddle,
        makeChild,
        "child"
      );
      expect(middle.k).toBe(9);
      // 重入写回的 9 已随嵌套 set 的同步 reaction 通知过;
      // 外层 mismatch 分支不得再按 (9 vs 被覆写的 7) 补发第二次 9
      expect(midSeen).toEqual([undefined, 7, 9]);
    }
  );

  test.each([
    ["base", observable, observable],
    ["shadow", shadowObservable, shadowObservable],
  ] as Array<[string, Make, Make]>)(
    "%s: 写入起点 middle (根帧 landed 分支), 同样单通知 [undefined,7,9]",
    (_label, makeMiddle, makeChild) => {
      const { middle, midSeen } = setupReentryChain(
        makeMiddle,
        makeChild,
        "middle"
      );
      expect(middle.k).toBe(9);
      expect(midSeen).toEqual([undefined, 7, 9]);
    }
  );
});

describe("转发帧重入窗口: setter defineProperty 回旧已通知值不得丢通知 (#4 丢通知)", () => {
  test.each([
    ["base", observable],
    ["shadow", shadowObservable],
  ] as Array<[string, Make]>)(
    "%s: 重入写 9 后 setter defineProperty 回 7, 观察序列必须含终值 7",
    (_label, makeMiddle) => {
      const { middle, midSeen } = setupReentryChain(
        makeMiddle,
        observable,
        "child",
        (m) => {
          // 真实终值 7: 若外层帧 notifiedValue 被覆写回 7, 该次落盘
          // (9→7) 会被判「已通知过」而静默跳过 → 观察者停留在 9
          Object.defineProperty(m, "k", dataDescriptor(7));
        }
      );
      expect(middle.k).toBe(7);
      expect(midSeen).toEqual([undefined, 7, 9, 7]);
      expect(midSeen[midSeen.length - 1]).toBe(middle.k);
    }
  );
});
