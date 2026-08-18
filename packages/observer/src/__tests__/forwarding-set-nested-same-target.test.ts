/*
 * 回归测试 (对抗审查 G2 第 3 轮遗留 medium, G2b):
 *
 * gp 的原型 setter 先对 middle 做 Object.defineProperty(middle,'k',{value:3})
 * (同 {mRaw,k} 命中 middle 在飞的转发帧, 透传并标记 hit), 随后又执行嵌套普通
 * 赋值 middle.k = 7 —— 嵌套 set trap 自己的 Reflect.set 路由回 defineProperty
 * trap 时, 旧实现会把**所有**同 {target,key} 的帧 (包括外层 middle 帧) 都标记
 * hit=true。外层 middle set trap 因此在 receiver-mismatch 分支额外通知一次,
 * 与嵌套 set 自己的通知叠加 → middle 双通知 (midCalls=3)。
 *
 * 期望: 对同一 {target,key} 的整个转发窗口只通知一次 —— midCalls=2, childCalls=2
 * (嵌套 set 落盘 3→7 的那次通知; 外层 middle 的 mismatch 通知与 child 的兜底
 * add 都应被抑制)。
 *
 * 复现脚本: /tmp/g2-attack-nested-set.ts
 */
import { observable, observe, shadowObservable } from "../main";

describe("转发帧: 嵌套 set 路由只属于栈顶帧 (G2b)", () => {
  test("setter 同 key defineProperty 后嵌套普通赋值, middle/child 各只通知一次", () => {
    const middle: Record<string, unknown> = observable({ side: 0 });
    const gpRaw: Record<string, unknown> = {};
    Object.defineProperty(gpRaw, "k", {
      configurable: true,
      set(this: unknown, _v: number) {
        Object.defineProperty(middle, "k", {
          value: 3,
          writable: true,
          enumerable: true,
          configurable: true,
        });
        // 嵌套普通 set: 此刻 k 已是 middle raw 的自有 data 属性,
        // Reflect.set 路由回 middle proxy 的 defineProperty trap
        middle.k = 7;
      },
    });
    const gp = observable(gpRaw);
    Object.setPrototypeOf(middle, gp);
    const child: Record<string, unknown> = observable(Object.create(middle));

    let midCalls = 0;
    observe(() => {
      void middle.k;
      midCalls++;
    });
    let childCalls = 0;
    observe(() => {
      void child.k;
      childCalls++;
    });
    expect(midCalls).toBe(1);
    expect(childCalls).toBe(1);

    child.k = 5;
    expect(middle.k).toBe(7);
    expect(midCalls).toBe(2);
    expect(childCalls).toBe(2);
  });

  test("对称 (shadow 中层): shadow middle 上同场景同样单通知", () => {
    const middle: Record<string, unknown> = shadowObservable({ side: 0 });
    const gpRaw: Record<string, unknown> = {};
    Object.defineProperty(gpRaw, "k", {
      configurable: true,
      set(this: unknown, _v: number) {
        Object.defineProperty(middle, "k", {
          value: 3,
          writable: true,
          enumerable: true,
          configurable: true,
        });
        middle.k = 7;
      },
    });
    const gp = observable(gpRaw);
    Object.setPrototypeOf(middle, gp);
    const child: Record<string, unknown> = observable(Object.create(middle));

    let midCalls = 0;
    observe(() => {
      void middle.k;
      midCalls++;
    });
    let childCalls = 0;
    observe(() => {
      void child.k;
      childCalls++;
    });
    expect(midCalls).toBe(1);
    expect(childCalls).toBe(1);

    child.k = 5;
    expect(middle.k).toBe(7);
    expect(midCalls).toBe(2);
    expect(childCalls).toBe(2);
  });
});
