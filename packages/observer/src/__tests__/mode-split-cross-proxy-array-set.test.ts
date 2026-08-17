/**
 * GG6 第 2 轮对抗审查加固: #6 分桶后同一 raw 的 deep/shadow 两个代理
 * 共享连接表, 数组与 Set 的跨代理通知语义此前无测试锁定。
 */

import { observable } from "../observable";
import { shadowObservable } from "../shadow-observable";
import { observe, unobserve } from "../observer";
import { getConnectionsCount } from "../internals/reaction-track";

describe("GG6 hardening: 跨代理数组/Set 通知", () => {
  test("shadow 代理上的 length 收缩要通知 deep 代理上注册的截断索引依赖", () => {
    const rawArr = [1, 2, 3, 4, 5];
    const s = shadowObservable(rawArr);
    const d = observable(rawArr);

    let idxCalls = 0;
    let lenCalls = 0;
    const ri = observe(() => {
      d[4] as number;
      idxCalls++;
    });
    const rl = observe(() => {
      (s as unknown as number[]).length;
      lenCalls++;
    });

    // 通过 shadow 代理收缩: deep 侧注册的 arr[4] 依赖也必须被通知
    (s as unknown as number[]).length = 3;
    expect(idxCalls).toBe(2);
    expect(lenCalls).toBe(2);

    // 通过 deep 代理增长: shadow 侧注册的 length 依赖被通知
    d.push(9);
    expect(lenCalls).toBe(3);

    unobserve(ri);
    unobserve(rl);
    expect(getConnectionsCount(rawArr)).toBe(0);
  });

  test("shadow 代理上的 Set.delete 要通知 deep 代理上的 has 依赖 (反之亦然)", () => {
    const rawSet = new Set([1, 2]);
    const s = shadowObservable(rawSet);
    const d = observable(rawSet);

    let dHas = 0;
    let sHas = 0;
    const rd = observe(() => {
      d.has(1);
      dHas++;
    });
    const rs = observe(() => {
      s.has(2);
      sHas++;
    });

    // has(1) 不受 add(3) 影响: 不得误通知
    d.add(3);
    expect(dHas).toBe(1);

    // shadow 侧删除 key 1: deep 侧 has(1) 依赖必须被通知
    s.delete(1);
    expect(dHas).toBe(2);
    expect(sHas).toBe(1);

    // deep 侧删除 key 2: shadow 侧 has(2) 依赖必须被通知
    d.delete(2);
    expect(sHas).toBe(2);

    unobserve(rd);
    unobserve(rs);
    expect(getConnectionsCount(rawSet)).toBe(0);
  });
});
