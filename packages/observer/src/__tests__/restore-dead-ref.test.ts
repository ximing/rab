/**
 * restoreReaction 的 WeakRef 死引用分支（reaction-track.ts）
 *
 * setToOwner 反查表弱持有 ConnectionMap 后，restoreReaction /
 * releaseReactionKeyConnection 在 deref 失败（target 已被 GC，map 随
 * connectionStore 的弱 key 消亡）时必须安全跳过，而不是抛错或恢复出
 * 孤儿 Set。GC 时机无法确定性触发，这里用「deref 恒返回 undefined」的
 * 假 WeakRef 在模块隔离环境下钉住该分支的行为。
 */

describe('restoreReaction：ConnectionMap 死引用分支', () => {
  const RealWeakRef = globalThis.WeakRef;

  afterEach(() => {
    globalThis.WeakRef = RealWeakRef;
    jest.restoreAllMocks();
  });

  it('deref 失败时 restore 安全跳过：重跑抛错正常上抛，无二次异常', () => {
    class FakeWeakRef<T extends object> {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_value: T) {}
      deref(): T | undefined {
        return undefined;
      }
    }
    globalThis.WeakRef = FakeWeakRef as unknown as typeof WeakRef;

    jest.isolateModules(() => {
      // 模块加载时读取 typeof WeakRef，必须在 mock 之后加载
      const { observable, observe, unobserve } = require('../main');
      const state = observable({ a: 0 });
      let fail = false;
      let runs = 0;
      const reaction = observe(() => {
        runs++;
        void state.a;
        if (fail) {
          throw new Error('boom');
        }
      });
      expect(runs).toBe(1);

      fail = true;
      // 写入触发重跑 → runAsReaction 抛错 → restoreReaction 尝试恢复上次
      // 连接；此时 deref 恒失败，必须走跳过分支：错误原样上抛、不崩溃
      expect(() => {
        state.a = 1;
      }).toThrow('boom');

      // reaction 仍受控（unobserve 不抛错即脱管路径完整）
      expect(() => unobserve(reaction)).not.toThrow();
    });
  });

  it('deref 失败时 releaseReaction 的空 entry 清理安全跳过', () => {
    class FakeWeakRef<T extends object> {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_value: T) {}
      deref(): T | undefined {
        return undefined;
      }
    }
    globalThis.WeakRef = FakeWeakRef as unknown as typeof WeakRef;

    jest.isolateModules(() => {
      const { observable, observe, unobserve } = require('../main');
      const state = observable({ a: 0 });
      let runs = 0;
      const reaction = observe(() => {
        runs++;
        void state.a;
      });
      // releaseReactionKeyConnection 的空 entry 清理会 deref owner.map，
      // 恒失败时必须跳过删除而不是抛错
      expect(() => unobserve(reaction)).not.toThrow();
      expect(runs).toBe(1);
    });
  });
});
