import { Container, ServiceIdentifier } from '../ioc';
import { Service } from '../service';

/**
 * Inject 装饰器选项
 */
export interface InjectOptions {}

/**
 * 依赖注入装饰器
 * 用于在 Service 类中自动注入依赖
 *
 * 核心特性：
 * - 支持从当前 Service 所属的容器自动解析依赖
 * - 支持类型安全的依赖注入
 * - 支持链式依赖解析
 * - 只能注入 Service 类型的依赖
 *
 * @param identifier 服务标识符（类、字符串或 Symbol）
 *
 * @example
 * ```typescript
 * // 基础用法：从当前 Service 的容器解析
 * class UserService extends Service {
 *   @Inject(Feature1Service)
 *   private feature1Service!: Feature1Service;
 * }
 *
 * // 使用字符串标识符
 * class UserService extends Service {
 *   @Inject('userRepository')
 *   private userRepository!: UserRepository;
 * }
 *
 * // 使用 Symbol 标识符
 * const USER_REPO = Symbol('UserRepository');
 * class UserService extends Service {
 *   @Inject(USER_REPO)
 *   private userRepository!: UserRepository;
 * }
 * ```
 */
export function Inject<T extends Service = Service>(
  identifier: ServiceIdentifier<T>
): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol | undefined) {
    if (!propertyKey) {
      throw new Error('Inject decorator must be used on a property');
    }

    // 在类的原型上存储注入元数据
    if (!target.__injectMetadata) {
      target.__injectMetadata = new Map();
    }

    target.__injectMetadata.set(propertyKey, {
      identifier,
    });

    // 使用 getter/setter 拦截属性访问
    let cachedValue: T | undefined;
    let isInitialized = false;

    Object.defineProperty(target, propertyKey, {
      get(this: Service): T {
        // 如果已经初始化过，直接返回缓存的值
        if (isInitialized) {
          return cachedValue as T;
        }

        // 从当前 Service 实例所属的容器解析
        const container = Container.getContainerOf(this);
        if (!container) {
          throw new Error(
            `Cannot resolve dependency for property "${String(propertyKey)}". ` +
              `Service instance is not associated with any container. ` +
              `Make sure the service is resolved from a container.`
          );
        }

        // 从容器解析依赖
        try {
          // 使用类型断言，因为 identifier 可能是类、字符串或 Symbol
          cachedValue = (
            typeof identifier === 'function'
              ? container.resolve(identifier as new (...args: any[]) => T)
              : container.resolve<T>(identifier as string | symbol)
          ) as T;
          isInitialized = true;
          return cachedValue;
        } catch (error) {
          throw new Error(
            `Failed to inject dependency for property "${String(propertyKey)}" ` +
              `with identifier "${String(identifier)}" from container "${container.getName()}". ` +
              `Error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      },

      set(this: Service, value: T): void {
        // 允许手动设置值（用于测试或特殊场景）
        cachedValue = value;
        isInitialized = true;
      },

      configurable: true,
      enumerable: true,
    });
  };
}

/**
 * 获取类的注入元数据
 * @param target 目标类
 * @returns 注入元数据 Map
 */
export function getInjectMetadata(target: any): Map<string | symbol, any> {
  return target.__injectMetadata || new Map();
}

/**
 * 检查属性是否被 @Inject 装饰
 * @param target 目标类
 * @param propertyKey 属性名
 * @returns 是否被装饰
 */
export function isInjected(target: any, propertyKey: string | symbol): boolean {
  const metadata = getInjectMetadata(target);
  return metadata.has(propertyKey);
}
