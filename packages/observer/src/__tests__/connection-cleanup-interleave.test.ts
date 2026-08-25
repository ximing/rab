/**
 * GG6 对抗加固: #12 空 entry 清理与同步嵌套 reaction 的交互
 *
 * 清理的安全性依赖一个不变量: "Set 变空 ⇒ 没有任何存活 reaction 的
 * cleaners 还引用该 Set"。以下场景全部是能想象到的破坏该不变量的途径
 * (批量同步触发、体内手动重跑、批内 unobserve、自 unobserve 后写同 key、
 * 抛错 reaction), 全部必须保持依赖不丢失、不复活、entry 归零。
 */

import { observable } from '../observable';
import { observe, unobserve } from '../observer';
import { getConnectionsCount } from '../internals/reaction-track';

describe('#12 空 entry 清理 × 同步嵌套 reaction', () => {
  test('批量触发中 R1 体内写另一 key 同步触发 R2, 双方依赖不丢失', () => {
    const rawObj: Record<string, number> = { a: 1, b: 1 };
    const o = observable(rawObj);

    let r1Calls = 0;
    let r2Calls = 0;
    const r2 = observe(() => {
      o.b;
      r2Calls++;
    });
    const r1 = observe(() => {
      const av = o.a;
      r1Calls++;
      if (av === 2) {
        o.b = 99; // R1 重跑体内写 b → 同步触发 R2 (不在栈上)
      }
    });

    o.a = 2;
    expect(r1Calls).toBe(2);
    expect(r2Calls).toBe(2);

    o.a = 3;
    o.b = 100;
    expect(r1Calls).toBe(3);
    expect(r2Calls).toBe(3);

    unobserve(r1);
    unobserve(r2);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('R1 体内手动重跑 R2 且 R2 切换依赖 (k→l), 旧 entry 清理且双方依赖正确', () => {
    const rawObj: Record<string, number> = { k: 1, l: 1 };
    const o = observable(rawObj);

    let r2Target = 'k';
    let r1Calls = 0;
    let r2Calls = 0;
    let r1First = true;
    const r2 = observe(() => {
      o[r2Target];
      r2Calls++;
    });
    const r1 = observe(() => {
      o.k;
      r1Calls++;
      if (r1First) {
        r1First = false;
        r2Target = 'l';
        // 手动重跑 r2: release 使 k 的 Set 删空 → entry 被清理,
        // 随后 r2 重新注册到 l
        (r2 as unknown as () => void)();
      }
    });

    expect(getConnectionsCount(rawObj)).toBe(2); // k(r1) + l(r2)

    o.k = 2;
    expect(r1Calls).toBe(2);
    expect(r2Calls).toBe(2); // r2 已不依赖 k, 不应被触发

    o.l = 2;
    expect(r2Calls).toBe(3); // r2 的新依赖必须生效

    unobserve(r1);
    unobserve(r2);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('三层嵌套手动重跑 (同 key), 依赖不丢失', () => {
    const rawObj: Record<string, number> = { k: 1 };
    const o = observable(rawObj);

    let c1 = 0;
    let c2 = 0;
    let c3 = 0;
    let pass = 1;
    const r3 = observe(() => {
      o.k;
      c3++;
    });
    const r2 = observe(() => {
      o.k;
      c2++;
      if (pass >= 1) (r3 as unknown as () => void)();
    });
    const r1 = observe(() => {
      o.k;
      c1++;
      if (pass >= 2) (r2 as unknown as () => void)();
    });

    pass = 2;
    o.k = 2;
    expect(c1).toBe(2);
    expect(c2).toBeGreaterThanOrEqual(2);
    expect(c3).toBeGreaterThanOrEqual(2);

    o.k = 3;
    expect(c1).toBe(3);
    expect(c3).toBeGreaterThan(2); // 最内层依赖未丢

    unobserve(r1);
    unobserve(r2);
    unobserve(r3);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('reaction 重跑时 unobserve 自己后立刻写同 key: 不复活、entry 归零', () => {
    const rawObj: Record<string, number> = { k: 1 };
    const o = observable(rawObj);

    let calls = 0;
    const holder: { r?: ReturnType<typeof observe> } = {};
    holder.r = observe(() => {
      o.k;
      calls++;
      if (calls === 2) {
        unobserve(holder.r as ReturnType<typeof observe>);
        // entry 已被清空删除; 不得异常、不得复活
        o.k = 2;
      }
    });

    expect(calls).toBe(1);
    o.k = 10; // 触发重跑 → 体内 unobserve 自己 + 写同 key
    expect(calls).toBe(2);
    expect(getConnectionsCount(rawObj)).toBe(0);

    o.k = 3;
    expect(calls).toBe(2); // 不得复活
  });

  test('自 unobserve 后继续读新 key: 不复活、entry 归零 (第2轮审查 issue 1)', () => {
    const rawObj: Record<string, number> = {};
    const o = observable(rawObj);

    let runs = 0;
    const holder: { r?: ReturnType<typeof observe> } = {};
    holder.r = observe(
      () => {
        o.a;
        runs++;
        if (runs === 1) {
          unobserve(holder.r as ReturnType<typeof observe>);
          // unobserve 之后仍在自身运行中, 继续读一个新 key:
          // 不得为已 unobserve 的 reaction 建立新依赖 (否则写入会复活它,
          // 且该连接无人释放, entry 永久搁浅)
          o.b;
        }
      },
      { lazy: true }
    );
    (holder.r as unknown as () => void)();

    expect(runs).toBe(1);
    // unobserve 已释放 a 的连接; b 的读取不得重新注册 → entry 必须归零
    expect(getConnectionsCount(rawObj)).toBe(0);

    o.a = 1;
    expect(runs).toBe(1); // 不复活
    o.b = 2;
    expect(runs).toBe(1); // 不复活 (核心: 新 key 的注册被跳过)
    expect(getConnectionsCount(rawObj)).toBe(0); // 无搁浅 entry
  });

  test('批内 unobserve 另一 reaction: 该 reaction 至多再跑一次 (批内已有), 之后不复活', () => {
    const rawObj: Record<string, number> = { v: 1 };
    const p = observable(rawObj);

    let cA = 0;
    let cB = 0;
    const hb: { b?: ReturnType<typeof observe> } = {};
    hb.b = observe(() => {
      p.v;
      cB++;
    });
    const a = observe(() => {
      p.v;
      cA++;
      if (cA === 2) {
        unobserve(hb.b as ReturnType<typeof observe>);
        p.v = 2;
      }
    });

    p.v = 0;
    // b 先于 a 进入批 (注册序), 所以 b 在被 unobserve 前已跑过一次
    expect(cA).toBe(2);
    expect(cB).toBe(2);
    expect(getConnectionsCount(rawObj)).toBe(1); // 只剩 a

    p.v = 9;
    expect(cA).toBe(3);
    expect(cB).toBe(2); // b 不复活

    unobserve(a);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('重跑时抛错的 reaction: 依赖保持, unobserve 后 entry 归零', () => {
    const rawObj: Record<string, number> = { v: 1 };
    const q = observable(rawObj);

    let boom = 0;
    let armed = false;
    const r = observe(() => {
      q.v;
      boom++;
      if (armed) {
        throw new Error('boom' + boom);
      }
    });
    expect(getConnectionsCount(rawObj)).toBe(1); // 依赖已建立

    armed = true;
    expect(() => {
      q.v = 2;
    }).toThrow('boom2'); // 批内隔离后 rethrow, 依赖重建
    expect(boom).toBe(2);
    expect(getConnectionsCount(rawObj)).toBe(1);

    unobserve(r);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });
});
