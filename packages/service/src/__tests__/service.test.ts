import { Service, type MethodState } from '../service';

/**
 * 测试 Service 类的 $model 功能
 */
describe('Service $model', () => {
  /**
   * 示例 Service 类
   */
  class UserService extends Service {
    async fetchUser(id: string) {
      // 模拟异步操作
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ id, name: 'John Doe' });
        }, 100);
      });
    }

    async fetchUserWithError(id: string) {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Failed to fetch user'));
        }, 100);
      });
    }

    syncMethod() {
      return 'sync result';
    }

    _privateMethod() {
      return 'private';
    }
  }

  it('应该为异步方法创建 loading 和 error 状态', async () => {
    const service = new UserService();

    // 验证初始状态
    expect(service.$model.fetchUser.loading).toBe(false);
    expect(service.$model.fetchUser.error).toBe(null);

    // 调用异步方法
    const promise = service.fetchUser('123');

    // 验证 loading 状态
    expect(service.$model.fetchUser.loading).toBe(true);

    // 等待完成
    await promise;

    // 验证完成后的状态
    expect(service.$model.fetchUser.loading).toBe(false);
    expect(service.$model.fetchUser.error).toBe(null);
  });

  it('应该在异步方法出错时设置 error 状态', async () => {
    const service = new UserService();

    try {
      await service.fetchUserWithError('123');
    } catch (e) {
      // 预期会抛出错误
    }

    // 验证错误状态
    expect(service.$model.fetchUserWithError.loading).toBe(false);
    expect(service.$model.fetchUserWithError.error).toBeInstanceOf(Error);
    expect(service.$model.fetchUserWithError.error?.message).toBe('Failed to fetch user');
  });

  it('应该为同步方法创建状态对象', () => {
    const service = new UserService();

    // 验证同步方法也有状态
    expect(service.$model.syncMethod.loading).toBe(false);
    expect(service.$model.syncMethod.error).toBe(null);

    // 调用同步方法
    const result = service.syncMethod();

    // 验证结果和状态
    expect(result).toBe('sync result');
    expect(service.$model.syncMethod.loading).toBe(false);
    expect(service.$model.syncMethod.error).toBe(null);
  });

  it('应该排除私有方法', () => {
    const service = new UserService();

    // 私有方法不应该在 $model 中
    expect((service.$model as any)._privateMethod).toBeUndefined();
  });

  it('应该支持类型推导', () => {
    const service = new UserService();

    // 这些应该能正确推导类型
    const fetchUserState: MethodState = service.$model.fetchUser;
    const syncMethodState: MethodState = service.$model.syncMethod;

    expect(fetchUserState.loading).toBe(false);
    expect(syncMethodState.error).toBe(null);
  });

  it('应该在多次调用时正确管理状态', async () => {
    const service = new UserService();

    // 第一次调用
    const promise1 = service.fetchUser('1');
    expect(service.$model.fetchUser.loading).toBe(true);
    await promise1;
    expect(service.$model.fetchUser.loading).toBe(false);

    // 第二次调用
    const promise2 = service.fetchUser('2');
    expect(service.$model.fetchUser.loading).toBe(true);
    await promise2;
    expect(service.$model.fetchUser.loading).toBe(false);
  });

  it('应该在新的异步调用时清除之前的错误', async () => {
    const service = new UserService();

    // 第一次调用失败
    try {
      await service.fetchUserWithError('1');
    } catch (e) {
      // 预期会抛出错误
    }
    expect(service.$model.fetchUserWithError.error).not.toBe(null);

    // 第二次调用成功
    const promise = service.fetchUserWithError('2');
    // 在调用时错误应该被清除
    expect(service.$model.fetchUserWithError.error).toBe(null);

    try {
      await promise;
    } catch (e) {
      // 预期会抛出错误
    }
  });
});
