import { observe, unobserve } from '@rabjs/observer';
import type { Reaction } from '@rabjs/observer';

/**
 * Memo 装饰器配置选项
 */
export interface MemoOptions {
  /**
   * 自定义缓存键生成函数
   * 默认使用 getter 名称作为缓存键
   */
  key?: string;
}

/**
 * 缓存状态接口
 */
interface CacheState {
  /** 缓存的值 */
  value: any;
  /** 是否已计算 */
  computed: boolean;
  /** 响应式 reaction，用于追踪依赖 */
  reaction: Reaction | null;
}

/**
 * 全局缓存存储
 * 使用 WeakMap<实例, Map<属性名, 缓存状态>> 的结构
 * 这样所有 @Memo 装饰器共享一个 WeakMap，避免为每个 getter 创建独立的 WeakMap
 */
const globalMemoCache = new WeakMap<any, Map<string | symbol, CacheState>>();

/**
 * Memo 装饰器，用于对 getter 方法进行缓存优化
 * 只有当依赖的响应式数据发生变化时，才会重新计算
 *
 * 核心特性：
 * - 自动追踪 getter 中访问的响应式依赖
 * - 依赖变化时自动失效缓存
 * - 每个实例独立缓存
 * - 完整的 TypeScript 类型支持
 *
 * 注意事项：
 * - 只能用于 getter 方法
 * - getter 中访问的数据必须是响应式的（Service 的属性自动是响应式的）
 * - 链式依赖（一个 memo getter 依赖另一个 memo getter）需要确保中间 getter 也被访问
 *
 * @param options - 配置选项
 *
 * @example
 * ```typescript
 * class UserService extends Service {
 *   users = [
 *     { id: 1, name: 'Alice', age: 25 },
 *     { id: 2, name: 'Bob', age: 30 }
 *   ];
 *
 *   // 基础用法：缓存计算结果
 *   @Memo()
 *   get totalAge() {
 *     console.log('计算 totalAge');
 *     return this.users.reduce((sum, user) => sum + user.age, 0);
 *   }
 *
 *   // 自定义缓存键
 *   @Memo({ key: 'custom-key' })
 *   get expensiveComputation() {
 *     return this.users.map(u => u.name).join(', ');
 *   }
 * }
 *
 * const service = new UserService();
 * console.log(service.totalAge); // 输出: "计算 totalAge" 和 55
 * console.log(service.totalAge); // 直接返回缓存的 55，不会重新计算
 *
 * // 修改依赖数据
 * service.users.push({ id: 3, name: 'Charlie', age: 35 });
 * console.log(service.totalAge); // 输出: "计算 totalAge" 和 90，重新计算
 * ```
 */
export function Memo(options: MemoOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    if (!descriptor || !descriptor.get) {
      throw new Error(
        `@Memo 装饰器只能用于 getter 方法，但 ${String(propertyKey)} 不是一个 getter`
      );
    }

    // 保存原始的 getter 函数
    const originalGetter = descriptor.get;

    /**
     * 获取或初始化实例的缓存状态
     * 使用全局 globalMemoCache，结构为：WeakMap<实例, Map<属性名, 缓存状态>>
     */
    const getCacheState = (instance: any): CacheState => {
      // 获取或创建该实例的缓存 Map
      let instanceCache = globalMemoCache.get(instance);
      if (!instanceCache) {
        instanceCache = new Map<string | symbol, CacheState>();
        globalMemoCache.set(instance, instanceCache);
      }

      // 获取或创建该属性的缓存状态
      let state = instanceCache.get(propertyKey);
      if (!state) {
        state = {
          value: undefined,
          computed: false,
          reaction: null,
        };
        instanceCache.set(propertyKey, state);
      }

      return state;
    };

    /**
     * 失效缓存
     */
    const invalidateCache = (state: CacheState) => {
      state.computed = false;
    };

    /**
     * 计算值并设置响应式追踪
     */
    const computeValue = (state: CacheState, instance: any) => {
      // 清理旧的 reaction
      if (state.reaction) {
        unobserve(state.reaction);
        state.reaction = null;
      }

      // 创建新的 reaction 来追踪依赖
      let hasError = false;
      let errorValue: any;

      state.reaction = observe(
        () => {
          try {
            // 执行 getter 并收集依赖
            state.value = originalGetter.call(instance);
            state.computed = true;
            hasError = false;
          } catch (error) {
            hasError = true;
            errorValue = error;
            state.computed = false;
          }
        },
        {
          // 使用 lazy: false 立即执行一次以收集依赖
          lazy: false,
          // 当依赖变化时，失效缓存
          scheduler: () => {
            invalidateCache(state);
          },
        }
      );

      // 如果计算过程中出错，抛出错误
      if (hasError) {
        throw errorValue;
      }

      return state.value;
    };

    // 替换 getter
    descriptor.get = function (this: any) {
      const state = getCacheState(this);

      // 如果缓存有效，直接返回
      if (state.computed) {
        return state.value;
      }

      // 否则重新计算
      return computeValue(state, this);
    };

    // 添加清理方法（可选，用于手动清理）
    const cleanupMethodName = `__cleanup_memo_${String(propertyKey)}`;
    if (!target[cleanupMethodName]) {
      target[cleanupMethodName] = function (this: any) {
        const instanceCache = globalMemoCache.get(this);
        if (instanceCache) {
          const state = instanceCache.get(propertyKey);
          if (state?.reaction) {
            unobserve(state.reaction);
            state.reaction = null;
          }
          instanceCache.delete(propertyKey);

          // 如果该实例没有其他缓存了，清理整个实例的缓存
          if (instanceCache.size === 0) {
            globalMemoCache.delete(this);
          }
        }
      };
    }

    return descriptor;
  };
}

/**
 * 手动失效指定 getter 的缓存
 * 用于需要手动控制缓存失效的场景
 *
 * @param instance - Service 实例
 * @param propertyKey - getter 属性名
 *
 * @example
 * ```typescript
 * class UserService extends Service {
 *   @Memo()
 *   get expensiveData() {
 *     return this.computeExpensiveData();
 *   }
 *
 *   forceRefresh() {
 *     invalidateMemo(this, 'expensiveData');
 *   }
 * }
 * ```
 */
export function invalidateMemo(instance: any, propertyKey: string | symbol): void {
  const cleanupMethodName = `__cleanup_memo_${String(propertyKey)}`;
  if (typeof instance[cleanupMethodName] === 'function') {
    instance[cleanupMethodName]();
  }
}

/**
 * 清理实例上所有 Memo 装饰器的缓存和 reaction
 * 通常在 Service 销毁时调用
 *
 * @param instance - Service 实例
 *
 * @example
 * ```typescript
 * class UserService extends Service {
 *   @Memo()
 *   get data1() { return this.compute1(); }
 *
 *   @Memo()
 *   get data2() { return this.compute2(); }
 *
 *   destroy() {
 *     cleanupAllMemos(this);
 *   }
 * }
 * ```
 */
export function cleanupAllMemos(instance: any): void {
  const proto = Object.getPrototypeOf(instance);
  const propertyNames = Object.getOwnPropertyNames(proto);

  propertyNames.forEach(propertyName => {
    const cleanupMethodName = `__cleanup_memo_${propertyName}`;
    if (typeof instance[cleanupMethodName] === 'function') {
      instance[cleanupMethodName]();
    }
  });
}
