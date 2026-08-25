import { Service } from '../service';
import { Container, createContainer } from '../ioc';

/**
 * 类型推导测试
 * 这个测试文件主要验证 TypeScript 类型推导是否正确工作
 */

class UserService extends Service {
  getName() {
    return 'UserService';
  }
}

class TodoService extends Service {
  getTodos() {
    return ['todo1', 'todo2'];
  }
}

describe('Container 类型推导测试', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer('type-test');
  });

  afterEach(async () => {
    await container.destroy();
  });

  describe('resolve 方法类型推导', () => {
    test('传入类时应该自动推导类型', () => {
      container.register(UserService);

      // 类型应该自动推导为 UserService，不需要显式泛型
      const userService = container.resolve(UserService);

      // TypeScript 应该知道 userService 有 getName 方法
      expect(userService.getName()).toBe('UserService');

      // 类型检查：如果类型推导正确，这行代码应该能编译通过
      const name: string = userService.getName();
      expect(name).toBe('UserService');
    });

    test('传入字符串时需要显式泛型', () => {
      container.register('userService', UserService);

      // 需要显式指定泛型
      const userService = container.resolve<UserService>('userService');

      expect(userService.getName()).toBe('UserService');
    });

    test('传入 Symbol 时需要显式泛型', () => {
      const USER_SERVICE = Symbol('userService');
      container.register(USER_SERVICE, UserService);

      // 需要显式指定泛型
      const userService = container.resolve<UserService>(USER_SERVICE);

      expect(userService.getName()).toBe('UserService');
    });

    test('多个不同类型的 Service 应该正确推导', () => {
      container.register(UserService);
      container.register(TodoService);

      // 每个都应该自动推导为正确的类型
      const userService = container.resolve(UserService);
      const todoService = container.resolve(TodoService);

      expect(userService.getName()).toBe('UserService');
      expect(todoService.getTodos()).toEqual(['todo1', 'todo2']);

      // 类型检查
      const name: string = userService.getName();
      const todos: string[] = todoService.getTodos();
      expect(name).toBe('UserService');
      expect(todos).toEqual(['todo1', 'todo2']);
    });
  });

  describe('tryResolve 方法类型推导', () => {
    test('传入类时应该自动推导类型为 T | undefined', () => {
      container.register(UserService);

      // 类型应该自动推导为 UserService | undefined
      const userService = container.tryResolve(UserService);

      expect(userService).toBeInstanceOf(UserService);
      if (userService) {
        expect(userService.getName()).toBe('UserService');
      }
    });

    test('传入字符串时需要显式泛型', () => {
      container.register('userService', UserService);

      // 需要显式指定泛型
      const userService = container.tryResolve<UserService>('userService');

      expect(userService).toBeInstanceOf(UserService);
      if (userService) {
        expect(userService.getName()).toBe('UserService');
      }
    });

    test('服务不存在时应该返回 undefined', () => {
      const userService = container.tryResolve(UserService);
      expect(userService).toBeUndefined();

      const todoService = container.tryResolve<TodoService>('todoService');
      expect(todoService).toBeUndefined();
    });
  });

  describe('混合使用场景', () => {
    test('应该支持类和字符串混合使用', () => {
      // 使用类作为标识符
      container.register(UserService);

      // 使用字符串作为标识符
      container.register('todoService', TodoService);

      // 类：自动推导
      const userService = container.resolve(UserService);

      // 字符串：需要泛型
      const todoService = container.resolve<TodoService>('todoService');

      expect(userService.getName()).toBe('UserService');
      expect(todoService.getTodos()).toEqual(['todo1', 'todo2']);
    });

    test('子容器应该继承父容器的类型推导', () => {
      container.register(UserService);

      const child = container.createChild('child');

      // 子容器解析时也应该自动推导类型
      const userService = child.resolve(UserService);

      expect(userService.getName()).toBe('UserService');
    });
  });

  describe('类型安全性验证', () => {
    test('不同类型的 Service 不应该混淆', () => {
      container.register(UserService);
      container.register(TodoService);

      const userService = container.resolve(UserService);
      const todoService = container.resolve(TodoService);

      // TypeScript 应该能区分这两个类型
      expect(userService).toBeInstanceOf(UserService);
      expect(todoService).toBeInstanceOf(TodoService);

      // 这些调用应该能编译通过
      expect(userService.getName()).toBe('UserService');
      expect(todoService.getTodos()).toEqual(['todo1', 'todo2']);
    });
  });
});
