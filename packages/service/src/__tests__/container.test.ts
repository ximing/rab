import { Service } from '../service';
import {
  Container,
  ServiceScope,
  createContainer,
  getGlobalContainer,
  resetGlobalContainer,
} from '../ioc';

/**
 * 测试用的服务类
 */
class UserService extends Service {
  private name: string = 'UserService';

  getName(): string {
    return this.name;
  }

  async fetchUser(id: string) {
    return { id, name: `User ${id}` };
  }

  destroy() {
    // 清理资源
  }
}

class TodoService extends Service {
  private todos: string[] = [];

  addTodo(todo: string) {
    this.todos.push(todo);
  }

  getTodos() {
    return this.todos;
  }
}

class DatabaseService extends Service {
  private connected = false;

  async connect() {
    this.connected = true;
    return 'Connected';
  }

  isConnected() {
    return this.connected;
  }

  destroy() {
    this.connected = false;
  }
}

class ConfigService extends Service {
  constructor(private config: any = {}) {
    super();
  }

  getConfig() {
    return this.config;
  }
}

/**
 * 测试辅助函数
 */
const createTestContainers = (count: number): Container[] => {
  return Array.from({ length: count }, (_, i) => createContainer(`test-container-${i}`));
};

const cleanupContainers = (containers: Container[]): void => {
  containers.forEach(c => !c.isDestroyed() && c.destroy());
};

describe('Container - 专门为 Service 定制的 IoC 容器', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer('test-container');
  });

  afterEach(() => {
    container.destroy();
  });

  describe('基础注册和解析', () => {
    describe('用法 1: register(ServiceClass, options?)', () => {
      test('应该使用类作为标识符注册服务', () => {
        container.register(UserService);
        const service = container.resolve(UserService);

        expect(service).toBeInstanceOf(UserService);
        expect(service.getName()).toBe('UserService');
      });

      test('应该支持指定作用域', () => {
        container.register(UserService, { scope: ServiceScope.Singleton });
        const service1 = container.resolve(UserService);
        const service2 = container.resolve(UserService);

        expect(service1).toBe(service2);
      });

      test('默认应该是单例模式', () => {
        container.register(UserService);
        const service1 = container.resolve(UserService);
        const service2 = container.resolve(UserService);

        expect(service1).toBe(service2);
      });

      test('应该支持瞬时模式', () => {
        container.register(UserService, { scope: ServiceScope.Transient });
        const service1 = container.resolve(UserService);
        const service2 = container.resolve(UserService);

        expect(service1).not.toBe(service2);
        expect(service1).toBeInstanceOf(UserService);
        expect(service2).toBeInstanceOf(UserService);
      });
    });

    describe('用法 2: register(identifier, ServiceClass, options?)', () => {
      test('应该使用字符串标识符注册服务', () => {
        container.register('userService', UserService);
        const service = container.resolve<UserService>('userService');

        expect(service).toBeInstanceOf(UserService);
        expect(service.getName()).toBe('UserService');
      });

      test('应该使用 Symbol 标识符注册服务', () => {
        const USER_SERVICE = Symbol('userService');
        container.register(USER_SERVICE, UserService);
        const service = container.resolve<UserService>(USER_SERVICE);

        expect(service).toBeInstanceOf(UserService);
      });

      test('应该支持指定作用域', () => {
        container.register('userService', UserService, { scope: ServiceScope.Transient });
        const service1 = container.resolve<UserService>('userService');
        const service2 = container.resolve<UserService>('userService');

        expect(service1).not.toBe(service2);
      });
    });

    describe('用法 3: register(identifier, lazyFunction, options?)', () => {
      test('应该使用工厂函数注册服务', () => {
        container.register('userService', () => new UserService());
        const service = container.resolve<UserService>('userService');

        expect(service).toBeInstanceOf(UserService);
      });

      test('工厂函数应该接收容器参数', () => {
        container.register(TodoService);
        container.register('userService', c => {
          const todoService = c.resolve(TodoService);
          expect(todoService).toBeInstanceOf(TodoService);
          return new UserService();
        });

        const service = container.resolve<UserService>('userService');
        expect(service).toBeInstanceOf(UserService);
      });

      test('应该支持解决循环依赖', () => {
        // ServiceA 依赖 ServiceB
        class ServiceA extends Service {
          constructor(public serviceB: ServiceB) {
            super();
          }
        }

        // ServiceB 依赖 ServiceA
        class ServiceB extends Service {
          public serviceA?: ServiceA;
          setServiceA(serviceA: ServiceA) {
            this.serviceA = serviceA;
          }
        }

        // 使用懒加载函数解决循环依赖
        container.register('serviceA', c => {
          const serviceB = c.resolve<ServiceB>('serviceB');
          return new ServiceA(serviceB);
        });

        container.register('serviceB', c => {
          const serviceB = new ServiceB();
          // 延迟设置 serviceA
          setTimeout(() => {
            serviceB.setServiceA(c.resolve<ServiceA>('serviceA'));
          }, 0);
          return serviceB;
        });

        const serviceA = container.resolve<ServiceA>('serviceA');
        const serviceB = container.resolve<ServiceB>('serviceB');

        expect(serviceA).toBeInstanceOf(ServiceA);
        expect(serviceB).toBeInstanceOf(ServiceB);
        expect(serviceA.serviceB).toBe(serviceB);
      });
    });

    test('应该支持链式调用', () => {
      const result = container
        .register(UserService)
        .register('todoService', TodoService)
        .register('dbService', () => new DatabaseService());

      expect(result).toBe(container);
    });
  });

  describe('便捷方法', () => {
    describe.each([
      { method: 'registerSingleton', isSingleton: true },
      { method: 'registerTransient', isSingleton: false },
    ])('$method', ({ method, isSingleton }) => {
      test(`应该注册${isSingleton ? '单例' : '瞬时'}服务`, () => {
        (container as any)[method](UserService);
        const service1 = container.resolve(UserService);
        const service2 = container.resolve(UserService);

        if (isSingleton) {
          expect(service1).toBe(service2);
        } else {
          expect(service1).not.toBe(service2);
        }
      });

      test(`应该支持自定义标识符`, () => {
        (container as any)[method]('userService', UserService);
        const service1 = container.resolve<UserService>('userService');
        const service2 = container.resolve<UserService>('userService');

        if (isSingleton) {
          expect(service1).toBe(service2);
        } else {
          expect(service1).not.toBe(service2);
        }
      });
    });
  });

  describe('服务作用域', () => {
    describe.each([
      { scope: ServiceScope.Singleton, isSame: true, name: 'Singleton' },
      { scope: ServiceScope.Transient, isSame: false, name: 'Transient' },
    ])('$name 作用域', ({ scope, isSame }) => {
      test(`应该${isSame ? '返回相同' : '返回不同'}的实例`, () => {
        container.register(UserService, { scope });

        const service1 = container.resolve(UserService);
        const service2 = container.resolve(UserService);

        if (isSame) {
          expect(service1).toBe(service2);
        } else {
          expect(service1).not.toBe(service2);
          expect(service1).toBeInstanceOf(UserService);
          expect(service2).toBeInstanceOf(UserService);
        }
      });
    });

    test('默认作用域应该是 Singleton', () => {
      container.register(UserService);

      const service1 = container.resolve(UserService);
      const service2 = container.resolve(UserService);

      expect(service1).toBe(service2);
    });
  });

  describe('树形容器结构', () => {
    test('应该创建子容器', () => {
      const child = container.createChild('child-1');

      expect(child.getParent()).toBe(container);
      expect(container.getChildren()).toContain(child);
    });

    test('子容器应该继承父容器的服务', () => {
      container.register(UserService);

      const child = container.createChild();
      const service = child.resolve(UserService);

      expect(service).toBeInstanceOf(UserService);
    });

    test('子容器可以覆盖父容器的服务', () => {
      container.register('config', () => new ConfigService({ source: 'parent' }));

      const child = container.createChild();
      child.register('config', () => new ConfigService({ source: 'child' }));

      const parentConfig = container.resolve<ConfigService>('config');
      const childConfig = child.resolve<ConfigService>('config');

      expect(parentConfig.getConfig().source).toBe('parent');
      expect(childConfig.getConfig().source).toBe('child');
    });

    test('应该支持多层嵌套', () => {
      container.register('level', () => new ConfigService({ value: 0 }));

      const child1 = container.createChild('child-1');
      child1.register('level', () => new ConfigService({ value: 1 }));

      const child2 = child1.createChild('child-2');
      child2.register('level', () => new ConfigService({ value: 2 }));

      expect(container.resolve<ConfigService>('level').getConfig().value).toBe(0);
      expect(child1.resolve<ConfigService>('level').getConfig().value).toBe(1);
      expect(child2.resolve<ConfigService>('level').getConfig().value).toBe(2);
    });

    test('应该获取容器路径', () => {
      const child1 = container.createChild('child-1');
      const child2 = child1.createChild('child-2');

      expect(container.getPath()).toContain('test-container');
      expect(child1.getPath()).toContain('test-container');
      expect(child1.getPath()).toContain('child-1');
      expect(child2.getPath()).toContain('child-2');
    });
  });

  describe('服务检查', () => {
    test('应该检查服务是否已注册', () => {
      container.register(UserService);

      expect(container.has(UserService)).toBe(true);
      expect(container.has('notExist')).toBe(false);
    });

    test('子容器应该能检查父容器的服务', () => {
      container.register(UserService);
      const child = container.createChild();

      expect(child.has(UserService)).toBe(true);
    });

    test('应该获取所有服务标识符', () => {
      container.register(UserService);
      container.register('todoService', TodoService);
      container.register('dbService', () => new DatabaseService());

      const identifiers = container.getServiceIdentifiers();
      expect(identifiers).toContain(UserService);
      expect(identifiers).toContain('todoService');
      expect(identifiers).toContain('dbService');
    });
  });

  describe('错误处理', () => {
    test('应该在服务未找到时抛出错误', () => {
      expect(() => {
        container.resolve('notExist');
      }).toThrow('Service not found');
    });

    test('tryResolve 应该在服务未找到时返回 undefined', () => {
      const result = container.tryResolve('notExist');
      expect(result).toBeUndefined();
    });

    test('应该在容器销毁后拒绝注册', () => {
      container.destroy();

      expect(() => {
        container.register(UserService);
      }).toThrow('Cannot register service on destroyed container');
    });

    test('应该在容器销毁后拒绝解析', () => {
      container.register(UserService);
      container.destroy();

      expect(() => {
        container.resolve(UserService);
      }).toThrow('Cannot resolve service on destroyed container');
    });

    test('应该拒绝无效的注册参数', () => {
      expect(() => {
        // @ts-ignore 测试错误情况
        container.register('service');
      }).toThrow('Invalid register arguments');
    });

    test('工厂函数应该返回 Service 实例，否则抛出异常', () => {
      // 返回普通对象
      container.register('invalidService', (() => ({ name: 'invalid' })) as any);
      expect(() => {
        container.resolve('invalidService');
      }).toThrow('Factory function must return a Service instance');
    });

    test('工厂函数返回 null 应该抛出异常', () => {
      container.register('nullService', (() => null) as any);
      expect(() => {
        container.resolve('nullService');
      }).toThrow('Factory function must return a Service instance');
    });

    test('工厂函数返回 undefined 应该抛出异常', () => {
      container.register('undefinedService', (() => undefined) as any);
      expect(() => {
        container.resolve('undefinedService');
      }).toThrow('Factory function must return a Service instance');
    });

    test('工厂函数返回基本类型应该抛出异常', () => {
      container.register('stringService', (() => 'invalid') as any);
      expect(() => {
        container.resolve('stringService');
      }).toThrow('Factory function must return a Service instance');
    });
  });

  describe('销毁管理', () => {
    test('应该销毁所有子容器', () => {
      const child1 = container.createChild('child-1');
      const child2 = container.createChild('child-2');

      container.destroy();

      expect(child1.isDestroyed()).toBe(true);
      expect(child2.isDestroyed()).toBe(true);
    });

    test('应该注销服务', () => {
      container.register(UserService);
      expect(container.has(UserService)).toBe(true);

      const result = container.unregister(UserService);
      expect(result).toBe(true);
      expect(container.has(UserService)).toBe(false);
    });
  });

  describe('实例-容器关系追踪', () => {
    test('应该通过实例获取对应的容器', () => {
      container.register(UserService);
      const service = container.resolve(UserService);

      const retrievedContainer = Container.getContainerOf(service);
      expect(retrievedContainer).toBe(container);
    });

    test('应该支持多个实例分别关联到不同的容器', () => {
      const [container1, container2] = createTestContainers(2);

      container1.register(UserService);
      container2.register(UserService);

      const service1 = container1.resolve(UserService);
      const service2 = container2.resolve(UserService);

      expect(Container.getContainerOf(service1)).toBe(container1);
      expect(Container.getContainerOf(service2)).toBe(container2);

      cleanupContainers([container1, container2]);
    });

    test('瞬时实例应该分别关联到容器', () => {
      container.registerTransient(UserService);

      const service1 = container.resolve(UserService);
      const service2 = container.resolve(UserService);

      expect(Container.getContainerOf(service1)).toBe(container);
      expect(Container.getContainerOf(service2)).toBe(container);
      expect(service1).not.toBe(service2);
    });

    test('工厂函数创建的实例应该关联到容器', () => {
      container.register('userService', () => new UserService());

      const service = container.resolve<UserService>('userService');
      expect(Container.getContainerOf(service)).toBe(container);
    });

    test('未注册的实例应该返回 undefined', () => {
      const unknownService = new UserService();
      expect(Container.getContainerOf(unknownService)).toBeUndefined();
    });
  });

  describe('分层查找与实例化 (关键特性)', () => {
    test('子容器 resolve 父容器的服务时，实例应该在父容器上创建', () => {
      container.register(UserService);
      const child = container.createChild('child');

      const service = child.resolve(UserService);

      // 实例应该关联到父容器，而不是子容器
      expect(Container.getContainerOf(service)).toBe(container);
    });

    test('单例服务在分层查找中应该被正确缓存', () => {
      container.register(UserService, { scope: ServiceScope.Singleton });
      const child = container.createChild('child');

      const service1 = container.resolve(UserService);
      const service2 = child.resolve(UserService);

      // 应该是同一个实例
      expect(service1).toBe(service2);
      expect(Container.getContainerOf(service1)).toBe(container);
      expect(Container.getContainerOf(service2)).toBe(container);
    });

    test('子容器覆盖的服务应该在子容器上创建', () => {
      container.register(UserService);
      const child = container.createChild('child');
      child.register(UserService, { scope: ServiceScope.Transient });

      const parentService = container.resolve(UserService);
      const childService = child.resolve(UserService);

      // 实例应该分别关联到各自的容器
      expect(Container.getContainerOf(parentService)).toBe(container);
      expect(Container.getContainerOf(childService)).toBe(child);
      expect(parentService).not.toBe(childService);
    });

    test('多层嵌套时应该在正确的容器上实例化', () => {
      container.register('config', () => new ConfigService({ level: 'root' }));
      const child1 = container.createChild('child1');
      const child2 = child1.createChild('child2');

      const rootConfig = container.resolve<ConfigService>('config');
      const child1Config = child1.resolve<ConfigService>('config');
      const child2Config = child2.resolve<ConfigService>('config');

      // 所有实例都应该是同一个（单例），关联到根容器
      expect(rootConfig).toBe(child1Config);
      expect(child1Config).toBe(child2Config);
      expect(Container.getContainerOf(rootConfig)).toBe(container);
    });

    test('工厂函数中的容器参数应该是找到定义的容器', () => {
      let capturedContainer: Container | undefined;

      container.register('service', ((c: any) => {
        capturedContainer = c;
        return new UserService();
      }) as any);

      const child = container.createChild('child');
      const service = child.resolve<UserService>('service');

      // 工厂函数接收的容器应该是根容器（定义所在的容器）
      expect(capturedContainer).toBe(container);
      expect(Container.getContainerOf(service)).toBe(container);
    });
  });

  describe('全局容器', () => {
    afterEach(() => {
      resetGlobalContainer();
    });

    test('应该获取全局容器', () => {
      const global1 = getGlobalContainer();
      const global2 = getGlobalContainer();

      expect(global1).toBe(global2);
    });

    test('应该重置全局容器', () => {
      const global1 = getGlobalContainer();
      global1.register(UserService);

      resetGlobalContainer();

      const global2 = getGlobalContainer();
      expect(global1).not.toBe(global2);
      expect(() => global2.resolve(UserService)).toThrow();
    });
  });

  describe('动态添加/移除子容器', () => {
    let parent: Container;
    let child: Container;

    beforeEach(() => {
      parent = createContainer('parent');
      child = new Container({ name: 'child' });
    });

    afterEach(() => {
      parent.destroy();
      if (!child.isDestroyed()) child.destroy();
    });

    test('应该动态添加独立容器作为子容器', () => {
      expect(child.getParent()).toBeUndefined();

      parent.addChild(child);

      expect(child.getParent()).toBe(parent);
      expect(parent.getChildren()).toContain(child);
    });

    test('应该支持链式调用添加多个子容器', () => {
      const child1 = new Container({ name: 'child1' });
      const child2 = new Container({ name: 'child2' });

      parent.addChild(child1).addChild(child2);

      expect(parent.getChildren()).toContain(child1);
      expect(parent.getChildren()).toContain(child2);

      child1.destroy();
      child2.destroy();
    });

    test('应该支持将容器从原父容器移除并添加到新父容器', () => {
      const parent2 = createContainer('parent2');

      parent.addChild(child);
      expect(child.getParent()).toBe(parent);

      parent2.addChild(child);
      expect(child.getParent()).toBe(parent2);
      expect(parent.getChildren()).not.toContain(child);
      expect(parent2.getChildren()).toContain(child);

      parent2.destroy();
    });

    test('不应该允许形成循环引用', () => {
      parent.addChild(child);

      expect(() => {
        child.addChild(parent);
      }).toThrow('would create circular reference');
    });

    test('动态添加的子容器应该能继承父容器的服务', () => {
      parent.register(UserService);
      parent.addChild(child);

      const service = child.resolve(UserService);
      expect(service).toBeInstanceOf(UserService);
    });
  });

  describe('更换父容器 (setParent)', () => {
    test('应该将容器从一个父容器移动到另一个父容器', () => {
      const parent1 = createContainer('parent1');
      const parent2 = createContainer('parent2');
      const child = new Container({ parent: parent1, name: 'child' });

      expect(child.getParent()).toBe(parent1);

      child.setParent(parent2);

      expect(child.getParent()).toBe(parent2);
      expect(parent1.getChildren()).not.toContain(child);
      expect(parent2.getChildren()).toContain(child);
    });

    test('应该支持将容器变为根容器', () => {
      const parent = createContainer('parent');
      const child = new Container({ parent, name: 'child' });

      expect(child.getParent()).toBe(parent);

      child.setParent(undefined);

      expect(child.getParent()).toBeUndefined();
      expect(parent.getChildren()).not.toContain(child);
    });

    test('不应该允许形成循环引用', () => {
      const parent = createContainer('parent');
      const child = new Container({ parent, name: 'child' });

      expect(() => {
        parent.setParent(child);
      }).toThrow('would create circular reference');
    });

    test('更换父容器后应该能继承新父容器的服务', () => {
      const parent1 = createContainer('parent1');
      const parent2 = createContainer('parent2');
      const child = new Container({ parent: parent1, name: 'child' });

      parent1.register('service1', () => new ConfigService({ value: 'from-parent1' }));
      parent2.register('service2', () => new ConfigService({ value: 'from-parent2' }));

      // 初始状态：child 继承 parent1 的服务
      expect(child.resolve<ConfigService>('service1').getConfig().value).toBe('from-parent1');
      expect(() => child.resolve('service2')).toThrow();

      // 更换父容器后：child 继承 parent2 的服务
      child.setParent(parent2);
      expect(child.resolve<ConfigService>('service2').getConfig().value).toBe('from-parent2');
      expect(() => child.resolve('service1')).toThrow();
    });
  });

  describe('复杂场景', () => {
    test('应该支持依赖注入', () => {
      container.register(TodoService);
      container.register('userService', c => {
        const todoService = c.resolve(TodoService);
        expect(todoService).toBeInstanceOf(TodoService);
        return new UserService();
      });

      const userService = container.resolve<UserService>('userService');
      expect(userService).toBeInstanceOf(UserService);
    });

    test('应该支持复杂的树形结构', () => {
      // 根容器
      container.register('appName', () => new ConfigService({ name: 'MyApp' }));
      container.register(TodoService);

      // 模块 A
      const moduleA = container.createChild('moduleA');
      moduleA.register(UserService);

      // 模块 B
      const moduleB = container.createChild('moduleB');
      moduleB.register(DatabaseService);

      // 模块 A 的子模块
      const moduleA1 = moduleA.createChild('moduleA1');

      // 验证继承关系
      expect(moduleA1.resolve<ConfigService>('appName').getConfig().name).toBe('MyApp');
      expect(moduleA1.resolve(UserService)).toBeInstanceOf(UserService);
      expect(() => moduleA1.resolve(DatabaseService)).toThrow();

      // 验证隔离性
      expect(moduleB.resolve(TodoService)).toBeInstanceOf(TodoService);
      expect(() => moduleB.resolve(UserService)).toThrow();
    });

    test('应该支持复杂的树形结构销毁', () => {
      // 根容器
      container.register('appName', () => new ConfigService({ name: 'MyApp' }));
      container.register(TodoService);

      // 模块 A
      const moduleA = container.createChild('moduleA');
      moduleA.register(UserService);

      // 模块 B
      const moduleB = container.createChild('moduleB');
      moduleB.register(DatabaseService);

      // 销毁根容器应该销毁所有子容器
      container.destroy();

      expect(container.isDestroyed()).toBe(true);
      expect(moduleA.isDestroyed()).toBe(true);
      expect(moduleB.isDestroyed()).toBe(true);
    });
  });

  describe('类型安全', () => {
    test('应该提供正确的类型推导', () => {
      container.register(UserService);
      const service = container.resolve(UserService);

      // TypeScript 应该能正确推导类型
      expect(service.getName()).toBe('UserService');
    });

    test('应该支持泛型约束', () => {
      container.register<UserService>(UserService);
      const service = container.resolve<UserService>(UserService);

      expect(service).toBeInstanceOf(UserService);
    });
  });
});
