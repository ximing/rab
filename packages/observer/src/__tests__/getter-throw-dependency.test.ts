/**
 * get trap：getter 抛错时的依赖注册（#247 根因）
 *
 * 背景：base/shadow proxy handler 的 get trap 先执行 Reflect.get，返回之后
 * 才 registerRunningReactionForOperation。getter 抛错时注册被跳过，读取方
 * reaction 以零依赖结束运行 —— 之后任何变更/notify 都不再唤醒它。
 * #247 只在 @Memo getter 里用 Reflect.has 预注册打了单消费者补丁，普通
 * getter 的根因仍在共享 trap 里。
 */
import { observable, shadowObservable, observe, notify } from '../main';

describe('get trap：getter 抛错时的依赖注册（#247 根因）', () => {
  it('普通 getter 抛错仍注册 (target,key) 依赖 —— notify 能唤醒外层 reaction', () => {
    let shouldThrow = true;
    const o = observable({
      get value() {
        if (shouldThrow) {
          throw new Error('boom');
        }
        return 42;
      },
    });

    let runs = 0;
    let seen: unknown;
    observe(() => {
      runs++;
      try {
        seen = o.value;
      } catch {
        seen = 'err';
      }
    });
    expect(runs).toBe(1);
    expect(seen).toBe('err');

    // getter 恢复后手动通知：reaction 必须能重跑读到新值。
    // 修复前：Reflect.get 抛错跳过注册，reaction 零依赖，notify 无反应。
    shouldThrow = false;
    notify(o, 'value');
    expect(runs).toBe(2);
    expect(seen).toBe(42);
  });

  it('shadow observable 的 get trap 同样注册（同一根因，另一份 trap 实现）', () => {
    let shouldThrow = true;
    const o = shadowObservable({
      get value() {
        if (shouldThrow) {
          throw new Error('boom');
        }
        return 42;
      },
    });

    let runs = 0;
    let seen: unknown;
    observe(() => {
      runs++;
      try {
        seen = o.value;
      } catch {
        seen = 'err';
      }
    });
    expect(runs).toBe(1);
    expect(seen).toBe('err');

    shouldThrow = false;
    notify(o, 'value');
    expect(runs).toBe(2);
    expect(seen).toBe(42);
  });

  it('getter 抛错不影响成功读取的既有语义：正常依赖注册与触发不变', () => {
    const o = observable({
      count: 1,
      get doubled() {
        return this.count * 2;
      },
    });

    let runs = 0;
    let seen = 0;
    observe(() => {
      runs++;
      seen = o.doubled;
    });
    expect(runs).toBe(1);
    expect(seen).toBe(2);

    o.count = 5;
    expect(runs).toBe(2);
    expect(seen).toBe(10);
  });
});
