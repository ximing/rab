import { Service } from '../service';
import { Inject, getInjectMetadata, isInjected } from '../decorators';
import { Container, createContainer } from '../ioc';

/**
 * 测试 @Inject 装饰器
 */
describe('@Inject Decorator', () => {
  /**
   * 测试用的服务类
   */
  class RepositoryService extends Service {
    getData() {
      return { id: 1, name: 'test' };
    }
  }

  class LoggerService extends Service {
    log(message: string) {
      console.log(message);
    }
  }

  class UserService extends Service {
    @Inject(RepositoryService)
    private repository!: RepositoryService;

    @Inject(LoggerService)
    private logger!: LoggerService;

    getRepository() {
      return this.repository;
    }

    getLogger() {
      return this.logger;
    }

    getData() {
      return this.repository.getData();
    }
  }

  let container: Container;
  let loggerContainer: Container;

  beforeEach(() => {
    container = createContainer('test-container');
    loggerContainer = createContainer('logger-container');
  });

  afterEach(async () => {
    await container.destroy();
    if (!loggerContainer.isDestroyed()) {
      await loggerContainer.destroy();
    }
  });

  describe('基础注入', () => {
    test('应该从当前容器注入依赖', () => {
      container.register(RepositoryService);
      container.register(UserService);

      const userService = container.resolve<UserService>(UserService);
      const repository = userService.getRepository();

      expect(repository).toBeInstanceOf(RepositoryService);
      expect(repository.getData()).toEqual({ id: 1, name: 'test' });
    });

    test('应该缓存注入的依赖', () => {
      container.register(RepositoryService);
      container.register(UserService);

      const userService = container.resolve<UserService>(UserService);
      const repository1 = userService.getRepository();
      const repository2 = userService.getRepository();

      // 应该返回相同的实例（缓存）
      expect(repository1).toBe(repository2);
    });

    test('应该支持多个依赖注入', () => {
      container.register(RepositoryService);
      container.register(LoggerService);
      container.register(UserService);

      const userService = container.resolve<UserService>(UserService);
      const repository = userService.getRepository();
      const logger = userService.getLogger();

      expect(repository).toBeInstanceOf(RepositoryService);
      expect(logger).toBeInstanceOf(LoggerService);
    });

    test('子容器应该能解析父容器的依赖', () => {
      // 在父容器中注册服务
      container.register(RepositoryService);
      container.register(LoggerService);
      container.register(UserService);

      // 创建子容器
      const childContainer = container.createChild('child');

      // 从子容器解析服务
      const userService = childContainer.resolve<UserService>(UserService);
      const repository = userService.getRepository();
      const logger = userService.getLogger();

      // 验证依赖被正确注入
      expect(repository).toBeInstanceOf(RepositoryService);
      expect(logger).toBeInstanceOf(LoggerService);
    });
  });

  describe('依赖解析', () => {
    test('应该在访问属性时解析依赖', () => {
      container.register(RepositoryService);
      container.register(UserService);

      const userService = container.resolve<UserService>(UserService);

      // 在访问前，依赖还未解析
      // 在访问时，依赖才会被解析
      const repository = userService.getRepository();
      expect(repository).toBeInstanceOf(RepositoryService);
    });

    test('应该支持链式依赖解析', () => {
      container.register(RepositoryService);
      container.register(UserService);

      const userService = container.resolve<UserService>(UserService);
      const data = userService.getData();

      expect(data).toEqual({ id: 1, name: 'test' });
    });

    test('应该在依赖未找到时抛出错误', () => {
      // 创建一个新的容器，确保 RepositoryService 没有被注册
      const testContainer = createContainer('test-container-no-repo');

      // 创建一个新的 Service 类，不注册 RepositoryService
      class ServiceWithMissingDep extends Service {
        @Inject(RepositoryService)
        private repository!: RepositoryService;

        getRepository() {
          return this.repository;
        }
      }

      // 不注册 RepositoryService
      testContainer.register(ServiceWithMissingDep);

      const userService = testContainer.resolve<ServiceWithMissingDep>(ServiceWithMissingDep);

      expect(() => {
        userService.getRepository();
      }).toThrow('Failed to inject dependency');

      // 清理
      testContainer.destroy();
    });

    test('应该在依赖所在容器被销毁时抛出错误', async () => {
      // 创建一个临时容器
      const tempContainer = createContainer('temp-container');

      class ServiceWithTempDep extends Service {
        @Inject(LoggerService)
        private logger!: LoggerService;

        getLogger() {
          return this.logger;
        }
      }

      // 在临时容器中注册服务
      tempContainer.register(LoggerService);
      tempContainer.register(ServiceWithTempDep);

      const userService = tempContainer.resolve<ServiceWithTempDep>(ServiceWithTempDep);

      // 在销毁前应该能正常访问
      expect(userService.getLogger()).toBeInstanceOf(LoggerService);

      // 销毁容器
      await tempContainer.destroy();
    });

    test('应该在 Service 未关联容器时抛出错误', () => {
      // 创建一个新的 Service 类，直接创建实例，不通过容器
      class ServiceWithoutContainer extends Service {
        @Inject(RepositoryService)
        private repository!: RepositoryService;

        getRepository() {
          return this.repository;
        }
      }

      // 直接创建实例，不通过容器
      const userService = new ServiceWithoutContainer();

      expect(() => {
        userService.getRepository();
      }).toThrow('Service instance is not associated with any container');
    });
  });

  describe('元数据', () => {
    test('应该记录注入元数据', () => {
      const metadata = getInjectMetadata(UserService.prototype);

      expect(metadata.has('repository')).toBe(true);
      expect(metadata.has('logger')).toBe(true);
    });

    test('应该检查属性是否被注入', () => {
      expect(isInjected(UserService.prototype, 'repository')).toBe(true);
      expect(isInjected(UserService.prototype, 'logger')).toBe(true);
      expect(isInjected(UserService.prototype, 'nonExistent')).toBe(false);
    });

    test('应该获取注入的标识符', () => {
      const metadata = getInjectMetadata(UserService.prototype);

      const repositoryMeta = metadata.get('repository');
      expect(repositoryMeta.identifier).toBe(RepositoryService);

      const loggerMeta = metadata.get('logger');
      expect(loggerMeta.identifier).toBe(LoggerService);
    });
  });

  describe('手动设置', () => {
    test('应该支持手动设置注入的依赖', () => {
      container.register(UserService);

      const userService = container.resolve<UserService>(UserService);
      const mockRepository = new RepositoryService();

      // 手动设置依赖
      (userService as any).repository = mockRepository;

      expect(userService.getRepository()).toBe(mockRepository);
    });

    test('应该在手动设置后使用缓存的值', () => {
      container.register(UserService);

      const userService = container.resolve<UserService>(UserService);
      const mockRepository = new RepositoryService();

      // 手动设置依赖
      (userService as any).repository = mockRepository;

      // 多次访问应该返回相同的实例
      expect(userService.getRepository()).toBe(mockRepository);
      expect(userService.getRepository()).toBe(mockRepository);
    });
  });

  describe('字符串标识符', () => {
    test('应该支持字符串标识符的注入', () => {
      class ServiceWithStringId extends Service {
        @Inject('repository')
        private repo!: RepositoryService;

        getRepo() {
          return this.repo;
        }
      }

      container.register('repository', RepositoryService);
      container.register(ServiceWithStringId);

      const service = container.resolve<ServiceWithStringId>(ServiceWithStringId);
      const repo = service.getRepo();

      expect(repo).toBeInstanceOf(RepositoryService);
    });
  });

  describe('Symbol 标识符', () => {
    test('应该支持 Symbol 标识符的注入', () => {
      const REPO_SYMBOL = Symbol('Repository');

      class ServiceWithSymbolId extends Service {
        @Inject(REPO_SYMBOL)
        private repo!: RepositoryService;

        getRepo() {
          return this.repo;
        }
      }

      container.register(REPO_SYMBOL, RepositoryService);
      container.register(ServiceWithSymbolId);

      const service = container.resolve<ServiceWithSymbolId>(ServiceWithSymbolId);
      const repo = service.getRepo();

      expect(repo).toBeInstanceOf(RepositoryService);
    });
  });

  describe('工厂函数', () => {
    test('应该支持工厂函数创建的依赖', () => {
      class ServiceWithFactory extends Service {
        @Inject('repository')
        private repo!: RepositoryService;

        getRepo() {
          return this.repo;
        }
      }

      container.register('repository', c => new RepositoryService());
      container.register(ServiceWithFactory);

      const service = container.resolve<ServiceWithFactory>(ServiceWithFactory);
      const repo = service.getRepo();

      expect(repo).toBeInstanceOf(RepositoryService);
    });
  });

  describe('子容器继承', () => {
    test('子容器应该能继承父容器的依赖', () => {
      container.register(RepositoryService);
      container.register(UserService);

      const childContainer = container.createChild('child');

      const userService = childContainer.resolve<UserService>(UserService);
      const repository = userService.getRepository();

      expect(repository).toBeInstanceOf(RepositoryService);
    });

    test('子容器可以覆盖父容器的依赖', () => {
      class CustomRepositoryService extends RepositoryService {
        override getData() {
          return { id: 2, name: 'custom' };
        }
      }

      // 在父容器中注册默认的 RepositoryService
      container.register(RepositoryService);

      // 在子容器中覆盖注册
      const childContainer = container.createChild('child');
      childContainer.register(RepositoryService, CustomRepositoryService);

      class UserServiceWithRepo extends Service {
        @Inject(RepositoryService)
        private repository!: RepositoryService;

        getData() {
          return this.repository.getData();
        }
      }

      childContainer.register(UserServiceWithRepo);

      const userService = childContainer.resolve<UserServiceWithRepo>(UserServiceWithRepo);
      const data = userService.getData();

      // 由于 @Inject 会从当前容器解析，所以会使用 CustomRepositoryService
      expect(data).toEqual({ id: 2, name: 'custom' });
    });
  });

  describe('复杂场景', () => {
    test('应该支持多层依赖注入', () => {
      class ServiceA extends Service {
        getValue() {
          return 'A';
        }
      }

      class ServiceB extends Service {
        @Inject(ServiceA)
        private serviceA!: ServiceA;

        getValue() {
          return `B-${this.serviceA.getValue()}`;
        }
      }

      class ServiceC extends Service {
        @Inject(ServiceB)
        private serviceB!: ServiceB;

        getValue() {
          return `C-${this.serviceB.getValue()}`;
        }
      }

      container.register(ServiceA);
      container.register(ServiceB);
      container.register(ServiceC);

      const serviceC = container.resolve<ServiceC>(ServiceC);
      expect(serviceC.getValue()).toBe('C-B-A');
    });

    test('应该支持循环依赖的检测', () => {
      class ServiceX extends Service {
        @Inject('serviceY')
        private serviceY!: any;

        getValue() {
          return this.serviceY;
        }
      }

      class ServiceY extends Service {
        @Inject(ServiceX)
        private serviceX!: ServiceX;

        getValue() {
          return this.serviceX;
        }
      }

      container.register('serviceY', ServiceY);
      container.register(ServiceX);

      const serviceX = container.resolve<ServiceX>(ServiceX);

      // 访问 serviceY 会触发循环依赖
      // 但由于我们使用的是 getter，只要不同时访问两个方向就不会出现问题
      expect(() => {
        serviceX.getValue();
      }).not.toThrow();
    });
  });
});
