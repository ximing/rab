import vm from 'vm';
import { observable, observe, shadowObservable } from '../main';

/*
 * GG7 对抗审查第 3 轮加固: 惰性 clear oldValue 的消费者矩阵 pin。
 * clear 的拷贝只在"本次操作会到达某个 reaction.debugger"时发生,
 * 以下每一条都是 debugger 确实收到 clear 前内容拷贝的路径:
 *   1. transformReactions 向通知集补充的带 debugger reaction (保守分支)
 *   2. 只依赖 size (iterate 键) 的 debugger reaction
 *   3. 跨 realm Map (constructor 非 plain -> 始终拷贝)
 *   4. shadow 写入通知 deep 侧注册的 debugger (共享连接表)
 *   5. NaN / Symbol / 空字符串 key 的拷贝内容完整性
 * */
describe('GG7 hardening: lazy clear oldValue consumer matrix', () => {
  test('transformReactions-added debugger receives a pre-clear copy', () => {
    const raw = new Map<string, number>([['a', 1]]);
    const extra = observe(() => {}, {
      debugger: () => {
        /* 占位, 下面替换 */
      },
    });
    const m = observable(raw, {
      reactionHandlers: {
        transformReactions: (_t, _k, reactions) => [...reactions, extra],
      },
    } as never);
    const seen: unknown[] = [];
    (extra as unknown as { debugger: (op: unknown) => void }).debugger = op => {
      const o = op as { type: string; oldValue?: unknown };
      if (o.type === 'clear') {
        seen.push(o.oldValue);
      }
    };
    m.clear();
    expect(seen).toHaveLength(1);
    expect(seen[0] instanceof Map).toBe(true);
    expect((seen[0] as Map<string, number>).get('a')).toBe(1);
  });

  test('size-only (iterate-key) dependency debugger receives a copy', () => {
    const m = observable(new Map<string, number>([['a', 1]]));
    const seen: unknown[] = [];
    observe(() => m.size, {
      debugger: operation => {
        if (operation.type === 'clear') {
          seen.push(operation.oldValue);
        }
      },
    });
    m.clear();
    expect(seen).toHaveLength(1);
    expect((seen[0] as Map<string, number>).get('a')).toBe(1);
  });

  test('cross-realm Map clear debugger receives a copy', () => {
    const raw = vm.runInNewContext("new Map([['a', 1]])") as Map<string, number>;
    const m = observable(raw);
    const seen: unknown[] = [];
    observe(() => m.get('a'), {
      debugger: operation => {
        if (operation.type === 'clear') {
          seen.push(operation.oldValue);
        }
      },
    });
    m.clear();
    expect(seen).toHaveLength(1);
    expect(seen[0] instanceof Map).toBe(true);
    expect((seen[0] as Map<string, number>).get('a')).toBe(1);
  });

  test('shadow clear notifies deep-side debugger with a copy', () => {
    const raw = new Map<string, number>([['a', 1]]);
    const deep = observable(raw);
    const shadow = shadowObservable(raw);
    const seen: unknown[] = [];
    observe(() => deep.get('a'), {
      debugger: operation => {
        if (operation.type === 'clear') {
          seen.push(operation.oldValue);
        }
      },
    });
    shadow.clear();
    expect(seen).toHaveLength(1);
    expect((seen[0] as Map<string, number>).get('a')).toBe(1);
  });

  test('copy content is complete for NaN / Symbol / empty-string keys', () => {
    const sym = Symbol('k');
    const m = observable(
      new Map<unknown, number>([
        [NaN, 1],
        [sym, 2],
        ['', 3],
      ])
    );
    const seen: unknown[] = [];
    observe(() => m.get(''), {
      debugger: operation => {
        if (operation.type === 'clear') {
          seen.push(operation.oldValue);
        }
      },
    });
    m.clear();
    const snap = seen[0] as Map<unknown, number>;
    expect(snap.size).toBe(3);
    expect(snap.get(NaN)).toBe(1);
    expect(snap.get(sym)).toBe(2);
    expect(snap.get('')).toBe(3);
  });
});
