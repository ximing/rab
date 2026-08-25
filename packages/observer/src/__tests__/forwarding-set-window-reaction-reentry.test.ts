/*
 * 加固测试 (对抗审查 GG2 回归镜头): 转发窗口内的同步 reaction 重入写回。
 *
 * 场景: child 无自有属性, 写 child.v 路由到 proto setter; setter 内写 other.x;
 * other.x 的同步 reaction 在 **转发窗口尚未出栈** 时再写 child.v (再次进 setter)。
 * 该重入链在修复前 (布尔标记) 与 {target,key} 帧栈下行为逐位一致 (实测对比过),
 * 本测试把该一致性钉死, 防止后续批次改动帧栈语义:
 * - 不得死循环 / 不得抛错;
 * - 两次写入都要被观察到 (otherCalls >= 2, childCalls >= 3);
 * - 不得出现双通知爆炸 (窗口内嵌套 set 不因外层在飞帧而重复通知: childCalls <= 4, otherCalls <= 3)。
 */
import { observable, observe } from '../main';

describe('转发窗口内同步 reaction 重入写回 in-flight key', () => {
  test('嵌套 setter 链收敛: 终值正确、两次写入均被观察、无双通知', () => {
    const other = observable({ x: 0 });
    const proto = observable({
      set v(val: number) {
        other.x = val;
      },
    });
    const child = observable(Object.create(proto)) as { v: number };
    let childCalls = 0;
    let otherCalls = 0;
    let guard = 0;
    observe(() => {
      void child.v;
      childCalls++;
    });
    observe(() => {
      otherCalls++;
      if (other.x > 0 && guard === 0) {
        guard = 1;
        child.v = 99;
      }
      void other.x;
    });
    expect(childCalls).toBe(1);
    expect(otherCalls).toBe(1);

    child.v = 1;

    // 链: child.v=1 → setter 写 other.x=1 → reaction 内 child.v=99 → setter 写 other.x=99
    expect(other.x).toBe(99);
    expect(guard).toBe(1);
    // 两次真实写入都被观察到
    expect(otherCalls).toBeGreaterThanOrEqual(2);
    expect(childCalls).toBeGreaterThanOrEqual(3);
    // 单通知语义: child 的两次写入共 +2, other 的两次写入共 +2 (guard 阻断后不再连锁)
    expect(childCalls).toBeLessThanOrEqual(4);
    expect(otherCalls).toBeLessThanOrEqual(3);
  });

  test('转发窗口内同步 reaction 对另一 observable 的 defineProperty 仍必须通知', () => {
    const other = observable({ y: 0 });
    const target = observable({ z: 0 });
    const proto = observable({
      set push(v: number) {
        // 先写 target 触发同步 reaction (窗口打开), reaction 内再 defineProperty
        target.z = v;
      },
    });
    const child = observable(Object.create(proto)) as { push: number };
    let yCalls = 0;
    let zRan = 0;
    observe(() => {
      zRan++;
      if (target.z > 0) {
        Object.defineProperty(other, 'y', {
          value: target.z * 10,
          configurable: true,
          writable: true,
        });
      }
      void target.z;
    });
    observe(() => {
      void other.y;
      yCalls++;
    });
    child.push = 3;
    expect(target.z).toBe(3);
    expect(other.y).toBe(30);
    expect(yCalls).toBe(2); // reaction 在转发窗口内发出的 defineProperty 不得被外层在飞帧吞掉
    expect(zRan).toBe(2);
  });
});
