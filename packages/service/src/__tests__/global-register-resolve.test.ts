import {
  register,
  resolve,
  has,
  Service,
  Container,
  resetGlobalContainer,
  ServiceScope,
} from '../main';

describe('Global register and resolve functions', () => {
  beforeEach(() => {
    // 重置全局容器以确保测试隔离
    resetGlobalContainer();
  });

  describe('register function', () => {
    it('should register a service using class as identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const container = register(UserService);
      expect(container).toBeInstanceOf(Container);
      expect(container.has(UserService)).toBe(true);
    });

    it('should register a service with custom identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const container = register('userService', UserService);
      expect(container).toBeInstanceOf(Container);
      expect(container.has('userService')).toBe(true);
    });

    it('should register a service with Symbol identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const symbol = Symbol('userService');
      const container = register(symbol, UserService);
      expect(container).toBeInstanceOf(Container);
      expect(container.has(symbol)).toBe(true);
    });

    it('should register a service with options', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const container = register(UserService, { scope: ServiceScope.Transient });
      expect(container).toBeInstanceOf(Container);
      expect(container.has(UserService)).toBe(true);
    });

    it('should register a service with custom container', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const customContainer = new Container({ name: 'custom' });
      const returnedContainer = register(UserService, undefined, customContainer);

      expect(returnedContainer).toBe(customContainer);
      expect(customContainer.has(UserService)).toBe(true);
    });

    it('should register a service with lazy factory function', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const container = register('userService', container => new UserService());
      expect(container).toBeInstanceOf(Container);
      expect(container.has('userService')).toBe(true);
    });

    it('should use global container by default', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const container1 = register(UserService);
      const container2 = register('anotherService', UserService);

      // 两个调用应该返回同一个全局容器
      expect(container1).toBe(container2);
    });
  });

  describe('resolve function', () => {
    it('should resolve a service using class identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      register(UserService);
      const service = resolve(UserService);

      expect(service).toBeInstanceOf(UserService);
      expect(service.name).toBe('UserService');
    });

    it('should resolve a service using string identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      register('userService', UserService);
      const service = resolve<UserService>('userService');

      expect(service).toBeInstanceOf(UserService);
      expect(service.name).toBe('UserService');
    });

    it('should resolve a service using Symbol identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const symbol = Symbol('userService');
      register(symbol, UserService);
      const service = resolve<UserService>(symbol);

      expect(service).toBeInstanceOf(UserService);
      expect(service.name).toBe('UserService');
    });

    it('should resolve from custom container', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const customContainer = new Container({ name: 'custom' });
      register(UserService, undefined, customContainer);
      const service = resolve(UserService, customContainer);

      expect(service).toBeInstanceOf(UserService);
      expect(service.name).toBe('UserService');
    });

    it('should throw error if service not found', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      expect(() => {
        resolve(UserService);
      }).toThrow('Service not found');
    });

    it('should return singleton instance by default', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      register(UserService);
      const service1 = resolve(UserService);
      const service2 = resolve(UserService);

      expect(service1).toBe(service2);
    });

    it('should return different instances for transient scope', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      register(UserService, { scope: ServiceScope.Transient });
      const service1 = resolve(UserService);
      const service2 = resolve(UserService);

      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(UserService);
      expect(service2).toBeInstanceOf(UserService);
    });
  });

  describe('has function', () => {
    it('should return true if service is registered', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      register(UserService);
      expect(has(UserService)).toBe(true);
    });

    it('should return false if service is not registered', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      expect(has(UserService)).toBe(false);
    });

    it('should check service with string identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      register('userService', UserService);
      expect(has('userService')).toBe(true);
      expect(has('nonExistentService')).toBe(false);
    });

    it('should check service with Symbol identifier', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const symbol = Symbol('userService');
      register(symbol, UserService);
      expect(has(symbol)).toBe(true);
      expect(has(Symbol('nonExistent'))).toBe(false);
    });

    it('should check service in custom container', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const customContainer = new Container({ name: 'custom' });
      register(UserService, undefined, customContainer);

      expect(has(UserService, customContainer)).toBe(true);
      expect(has(UserService)).toBe(false); // 全局容器中不存在
    });

    it('should support hierarchical container lookup', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      class TodoService extends Service {
        name = 'TodoService';
      }

      const parentContainer = new Container({ name: 'parent' });
      const childContainer = new Container({ parent: parentContainer, name: 'child' });

      register(UserService, undefined, parentContainer);
      register(TodoService, undefined, childContainer);

      // 子容器可以查找到父容器中的服务
      expect(has(UserService, childContainer)).toBe(true);
      expect(has(TodoService, childContainer)).toBe(true);

      // 父容器查找不到子容器中的服务
      expect(has(TodoService, parentContainer)).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should work with multiple services', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      class TodoService extends Service {
        name = 'TodoService';
      }

      register(UserService);
      register(TodoService);

      const userService = resolve(UserService);
      const todoService = resolve(TodoService);

      expect(userService.name).toBe('UserService');
      expect(todoService.name).toBe('TodoService');
    });

    it('should work with service methods', async () => {
      class UserService extends Service {
        async fetchUser(id: string) {
          return { id, name: 'John' };
        }
      }

      register(UserService);
      const service = resolve(UserService);

      const result = await service.fetchUser('123');
      expect(result).toEqual({ id: '123', name: 'John' });
    });

    it('should support multiple containers', () => {
      class UserService extends Service {
        name = 'UserService';
      }

      const container1 = new Container({ name: 'container1' });
      const container2 = new Container({ name: 'container2' });

      register(UserService, undefined, container1);
      register(UserService, undefined, container2);

      const service1 = resolve(UserService, container1);
      const service2 = resolve(UserService, container2);

      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(UserService);
      expect(service2).toBeInstanceOf(UserService);
    });
  });
});
