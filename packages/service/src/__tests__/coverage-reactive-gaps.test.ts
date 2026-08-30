/**
 * 响应式 Service API 未覆盖分支：用行为断言补洞。
 * 失败 = 真实契约缺口。
 */
import { observe } from '@rabjs/observer';
import { Service } from '../service';
import { Action, Memo, invalidateMemo, cleanupAllMemos } from '../decorators';

describe('invalidateMemo 与外部 observe', () => {
  // #199：invalidateMemo 清缓存后必须 notify(instance, key)，唤醒读过该 getter 的外层 observe。
  it('invalidateMemo 唤醒读过该 getter 的外层 observe（#199）', () => {
    let external = 1;
    let computeCount = 0;

    class SourceService extends Service {
      @Memo()
      get value() {
        computeCount++;
        return external;
      }
    }

    const service = new SourceService();
    const seen: number[] = [];
    observe(() => {
      seen.push(service.value);
    });
    expect(seen).toEqual([1]);
    expect(computeCount).toBe(1);

    external = 2;
    invalidateMemo(service, 'value');

    expect(seen).toEqual([1, 2]);
    expect(computeCount).toBe(2);
    expect(service.value).toBe(2);
    expect(computeCount).toBe(2);
  });

  it('invalidateMemo 对不存在的 memo 属性是空操作', () => {
    class SourceService extends Service {
      n = 1;
    }
    const service = new SourceService();
    expect(() => invalidateMemo(service, 'missing')).not.toThrow();
  });

  it('cleanupAllMemos 后再次读取会重新计算', () => {
    let computeCount = 0;
    class SourceService extends Service {
      n = 1;
      @Memo()
      get doubled() {
        computeCount++;
        return this.n * 2;
      }
    }
    const service = new SourceService();
    expect(service.doubled).toBe(2);
    expect(computeCount).toBe(1);
    cleanupAllMemos(service);
    expect(service.doubled).toBe(2);
    expect(computeCount).toBe(2);
  });
});

describe('@Action 与默认方法拦截', () => {
  it('@Action 方法仍走 $model loading/error 包装', async () => {
    class UserService extends Service {
      @Action
      async fetchName() {
        return 'ada';
      }
    }
    const service = new UserService();
    expect(service.$model.fetchName.loading).toBe(false);
    const pending = service.fetchName();
    expect(service.$model.fetchName.loading).toBe(true);
    await pending;
    expect(service.$model.fetchName.loading).toBe(false);
    expect(service.$model.fetchName.error).toBeNull();
  });
});

describe('Service.resolve 无容器', () => {
  it('直接 new 出的 Service 调用 resolve 抛出未关联容器错误', () => {
    class OrphanService extends Service {
      grab() {
        return this.resolve('missing');
      }
    }
    const service = new OrphanService();
    expect(() => service.grab()).toThrow(/not associated with any container/);
  });
});
