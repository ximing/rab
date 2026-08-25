/**
 * 修复 #12: releaseReactionKeyConnection 只做 Set.delete(reaction),
 * 空的 Set 和所属 Map entry 永久残留 (实测 5 万动态 key 约 10MB, ~200B/key)。
 *
 * 修复后: Set 变空时把该 entry 从所属 ConnectionMap 里删掉。
 * getConnectionsCount 是仅供测试使用的内部探针。
 */

import { observable } from '../observable';
import { observe, unobserve } from '../observer';
import { getConnectionsCount } from '../internals/reaction-track';
import type { Reaction } from '../internals/types';

describe('#12 空 connection entry 清理', () => {
  test('unobserve 后: N 个动态 key 的 connection entry 数归零', () => {
    const rawObj: Record<string, number> = {};
    const obj = observable(rawObj);

    const reactions: Reaction[] = [];
    for (let i = 0; i < 50; i++) {
      const key = 'k' + i;
      reactions.push(
        observe(() => {
          obj[key] as number;
        })
      );
    }
    expect(getConnectionsCount(rawObj)).toBe(50);

    for (const r of reactions) {
      unobserve(r);
    }
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('同一 key 多个 reaction: 全部释放后才清除 entry', () => {
    const rawObj = { v: 1 };
    const obj = observable(rawObj);

    const r1 = observe(() => {
      obj.v;
    });
    const r2 = observe(() => {
      obj.v;
    });
    expect(getConnectionsCount(rawObj)).toBe(1);

    unobserve(r1);
    // r2 仍依赖 v, entry 必须保留
    expect(getConnectionsCount(rawObj)).toBe(1);

    unobserve(r2);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('释放后再次 observe 同 key 正常工作 (无 stale)', () => {
    const rawObj = { v: 1 };
    const obj = observable(rawObj);

    const r1 = observe(() => {
      obj.v;
    });
    unobserve(r1);
    expect(getConnectionsCount(rawObj)).toBe(0);

    let calls = 0;
    const r2 = observe(() => {
      obj.v;
      calls++;
    });
    expect(calls).toBe(1);
    expect(getConnectionsCount(rawObj)).toBe(1);

    // 新注册的依赖正常触发
    obj.v = 2;
    expect(calls).toBe(2);

    // 已释放的 r1 不得复活
    unobserve(r2);
    obj.v = 3;
    expect(calls).toBe(2);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('reaction 重跑切换依赖后, 旧 key 的空 entry 被清除', () => {
    const rawObj: Record<string, number> = {};
    const obj = observable(rawObj);

    let key = 'a';
    const r = observe(() => {
      obj[key] as number;
    });
    expect(getConnectionsCount(rawObj)).toBe(1);

    key = 'b';
    r();
    // 旧 "a" entry (已空) 被清除, 新 "b" entry 建立
    expect(getConnectionsCount(rawObj)).toBe(1);

    unobserve(r);
    expect(getConnectionsCount(rawObj)).toBe(0);
  });

  test('集合对象 key (WeakRef 包装) 的 entry 同样被清理', () => {
    const rawMap = new Map();
    const m = observable(rawMap);
    const keyObj = { id: 1 };

    const r = observe(() => {
      m.get(keyObj);
    });
    expect(getConnectionsCount(rawMap)).toBe(1);

    unobserve(r);
    expect(getConnectionsCount(rawMap)).toBe(0);
  });
});
