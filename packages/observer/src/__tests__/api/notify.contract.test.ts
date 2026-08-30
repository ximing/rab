/**
 * 本文件是 notify() 的公开行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * notify(target, key) 手动唤醒依赖 target.key 的 reactions：
 * accessor / @Memo 这类没有落盘 set 的属性在依赖变化后需要这条路径。
 * 传入 proxy 或 raw 均可。
 */
import { observable, observe, unobserve, batch, notify, raw, resetGlobalConfig } from '../../main';

afterEach(() => {
  resetGlobalConfig();
});

describe('notify() 公开契约', () => {
  test('notify(proxy, key) 唤醒读过该 key 的 observe，reaction 重跑并读到当前值', () => {
    const state = observable({ n: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(state.n);
    });
    expect(seen).toEqual([1]);

    notify(state, 'n');
    expect(seen).toEqual([1, 1]);
  });

  test('notify(raw, key) 与 notify(proxy, key) 等价：同一批依赖都被唤醒', () => {
    const state = observable({ n: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(state.n);
    });
    notify(raw(state), 'n');
    expect(seen).toEqual([1, 1]);
  });

  test('notify 未读过的 key 不唤醒 reaction', () => {
    const state = observable({ a: 1, b: 2 });
    let runs = 0;
    observe(() => {
      runs++;
      return state.a;
    });
    expect(runs).toBe(1);
    notify(state, 'b');
    expect(runs).toBe(1);
  });

  test('batch 内的 notify 推迟到最外层 batch 结束才跑 reaction', () => {
    const state = observable({ n: 1 });
    const seen: number[] = [];
    observe(() => {
      seen.push(state.n);
    });
    batch(() => {
      state.n = 2;
      notify(state, 'n');
      expect(seen).toEqual([1]);
    });
    expect(seen).toEqual([1, 2]);
  });

  test('unobserve 之后 notify 不再唤醒该 reaction', () => {
    const state = observable({ n: 1 });
    let runs = 0;
    const reaction = observe(() => {
      runs++;
      return state.n;
    });
    unobserve(reaction);
    notify(state, 'n');
    expect(runs).toBe(1);
  });
});
