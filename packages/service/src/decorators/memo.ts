import { observe, unobserve, notify, batch } from '@rabjs/observer';
import type { Reaction, Operation } from '@rabjs/observer';

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
  /**
   * 最近一次计算抛出的错误（若有）。
   * reaction 是跨 computeValue 调用复用的 (#248)，其函数体闭包只能
   * 写 state 上的字段；用 computeValue 的局部变量会把错误写到
   * 创建 reaction 那次调用的旧闭包上，后续抛错被静默吞掉 (#247)。
   */
  error?: { value: any } | null;
  /**
   * 本次计算期间读到的其它 memo 缓存（链式依赖 A→B）。
   * debugger 钩子只按 reaction 的直接依赖做同步失效记账（#248），
   * 链式场景中 batch 内写 B 的底层依赖只会让 B.computed=false，
   * A 并不在写路径的反应集合里 —— 不带链校验的话，batch 中途读 A
   * 拿到的仍是旧缓存。每次计算前重置，只保留最新一轮的边。
   */
  memoDeps?: Set<CacheState>;
  /** 链校验重入保护（环状 memo 引用本就属于未定义行为，校验不得自旋） */
  validating?: boolean;
  /**
   * 最近一次成功计算之后是否有写操作打在同步失效钩子上。
   * debugger 置位、computeValue 清除；flush 时的 scheduler 据此区分
   * 「待失效」与「mid-batch 已重算过」（见 scheduler 注释）。
   */
  dirtySinceCompute?: boolean;
}

/**
 * 全局缓存存储
 * 使用 WeakMap<实例, Map<属性名, 缓存状态>> 的结构
 * 这样所有 @Memo 装饰器共享一个 WeakMap，避免为每个 getter 创建独立的 WeakMap
 */
const globalMemoCache = new WeakMap<any, Map<string | symbol, CacheState>>();

/**
 * 正在计算中的 memo 缓存（链式依赖采集用）。
 * memo A 的 reaction 运行期间读到另一个 memo B 的 getter 时，
 * 把 B 的 CacheState 记入 A.memoDeps（见 CacheState.memoDeps）。
 */
let collectingMemo: CacheState | null = null;

/**
 * 把「读取方 collectingMemo 依赖了被读 memo state」这条边记下来
 */
function recordMemoDep(state: CacheState): void {
  if (collectingMemo && collectingMemo !== state) {
    (collectingMemo.memoDeps ??= new Set()).add(state);
  }
}

/**
 * 链式缓存有效性校验：本 state 标记为 computed，且它上次计算读到的
 * 所有 memo 缓存也都 (递归地) 有效，缓存才可信任。
 * 非链式 memo（memoDeps 为空）走 O(1) 快路径，不产生额外开销。
 */
function isChainValid(state: CacheState): boolean {
  const deps = state.memoDeps;
  if (!deps || deps.size === 0) {
    return true;
  }
  // 环状引用：不阻断，交回 getter 自身的递归语义（与原行为一致）
  if (state.validating) {
    return true;
  }
  state.validating = true;
  try {
    for (const dep of deps) {
      if (!dep.computed || !isChainValid(dep)) {
        return false;
      }
    }
    return true;
  } finally {
    state.validating = false;
  }
}

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
     * 计算值并设置响应式追踪
     */
    const computeValue = (state: CacheState, instance: any) => {
      // 复用同一个 reaction 而不是每次 unobserve + 重建：
      // batch 中途的读取发生在失效 reaction 已排队待冲刷之后，若重建，
      // 旧 reaction 被 unobserve，flush 时 runQueuedReaction 会跳过它，
      // scheduler 里的 notify 随之丢失，外层 observer 收不到唤醒 (#248)。
      if (!state.reaction) {
        state.reaction = observe(
          () => {
            try {
              // 执行 getter 并收集依赖
              state.value = originalGetter.call(instance);
              state.computed = true;
              state.error = null;
            } catch (error) {
              state.error = { value: error };
              state.computed = false;
            }
          },
          {
            // lazy: 依赖收集由下方 state.reaction() 手动调用触发
            lazy: true,
            // 当依赖变化时，失效缓存
            scheduler: () => {
              // 但 batch 中途的读取可能已经手动重算过（dirty 在 computeValue
              // 里被清除）—— 此时不得再盲目 computed=false，否则 flush 会
              // 丢弃那次重算、强制 getter 再跑一遍：不纯 getter（Date.now
              // 等）会出现 batch 内读到 A、batch 后读到 B 的值发散，且每次
              // batch 白付一次重复计算。
              if (state.dirtySinceCompute) {
                state.computed = false;
                state.dirtySinceCompute = false;
              }
              // getter 是 accessor, 依赖变化没有落盘 set; 必须唤醒读过该
              // 属性名的外层 observe / observer 组件 (#196)。notify 无条件
              // 执行：外层在重跑时读到的是当前缓存（可能正是 mid-batch 的
              // 重算结果），是否重算由 computed/链校验决定。
              notify(instance, propertyKey);
            },
            // 同步失效钩子 (#248)：batch/flush 期间 reaction 的调度被整体
            // 推迟 (queueReactionsForOperation 在 defer 判断之后才调用
            // scheduler)，只靠 scheduler 的话 computed=false 要到 flush 才
            // 生效，batch 中途读到的是过期缓存。debugger 是触发路径上唯一
            // 同步执行的 per-reaction 回调 (defer 判断之前)，用它做失效记账。
            // 注册路径 (reaction 自身读依赖) 只会报 get/has/iterate 读操作，
            // 只响应写操作即可避开；isDebugging 重入窗口内漏掉的失效由
            // scheduler 里的 computed=false 在 flush 时兜底。
            debugger: Object.assign(
              (operation: Operation) => {
                if (
                  operation.type === 'set' ||
                  operation.type === 'add' ||
                  operation.type === 'delete' ||
                  operation.type === 'clear'
                ) {
                  state.computed = false;
                  state.dirtySinceCompute = true;
                }
              },
              // 只看 operation.type，不消费 oldValue —— 避免本 hook 让
              // Map/Set clear() 背上 O(n) 旧值快照的热路径开销
              { wantsOldValue: false }
            ),
          }
        );
      }

      // 手动运行/重跑以收集最新依赖。
      // 同时采集本次计算读到的其它 memo 缓存（链式依赖边）
      // —— 上一轮依赖可能已随分支变化失效，每轮重置。
      state.memoDeps = new Set();
      const prevCollecting = collectingMemo;
      collectingMemo = state;
      try {
        state.reaction();
        // 本次重算已覆盖到此为止的所有写操作 —— flush 时 scheduler
        // 不得再按旧失效记账强制重算（见 dirtySinceCompute）
        state.dirtySinceCompute = false;
      } finally {
        collectingMemo = prevCollecting;
      }

      // 如果计算过程中出错，抛出错误
      if (state.error) {
        const errorValue = state.error.value;
        state.error = null;
        throw errorValue;
      }

      return state.value;
    };

    // 替换 getter
    descriptor.get = function (this: any) {
      const state = getCacheState(this);

      // 如果缓存有效（本层标记 + 链式依赖递归有效），直接返回。
      // 链校验只覆盖 memo→memo 的中间缓存；直达 observable 的依赖由
      // debugger 同步失效钩子 (#248) 负责。
      if (state.computed && isChainValid(state)) {
        recordMemoDep(state);
        return state.value;
      }

      // 计算可能抛错：proxy get trap 在 Reflect.get 返回之后才注册依赖，
      // getter 抛出时本次注册被跳过，外层 reaction 会以零依赖结束运行，
      // 之后任何变更都不再唤醒它 (#247)。先经 has trap 预注册
      // (instance, propertyKey) 依赖 —— has trap 的注册不依赖 getter 成功。
      // this 不是 proxy (如 raw 读取) 时无 trap，自然退化为空操作。
      Reflect.has(this, propertyKey);

      // 否则重新计算
      const result = computeValue(state, this);
      // 本次读取发生在另一个 memo 的计算中 —— 记录链式依赖边
      recordMemoDep(state);
      return result;
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
    // 手动失效与依赖变化路径（scheduler 里的 notify，见 #196）对齐：
    // 失效后必须唤醒读过该属性名的外层 observe / observer 组件 (#199)。
    // Service.destroy 不走这里（它调 cleanupAllMemos 且传 notify:false），
    // 销毁路径不唤醒已卸载的 UI。
    notify(instance, propertyKey);
  }
}

/**
 * cleanupAllMemos 的选项
 */
export interface CleanupAllMemosOptions {
  /**
   * 清理后是否通知读过这些 memo getter 的外层 observe / observer 组件。
   * 默认 true：作为「重置全部缓存」的公共 API 使用时，挂载中的观察者
   * 必须被唤醒以读到重置后的新值 (#255)。
   * Service.destroy 传 false：销毁路径保持静默，不唤醒已卸载的 UI。
   */
  notify?: boolean;
}

/**
 * 清理实例上所有 Memo 装饰器的缓存和 reaction
 * 通常在 Service 销毁时调用
 *
 * @param instance - Service 实例
 * @param options - 选项，见 CleanupAllMemosOptions
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
export function cleanupAllMemos(instance: any, options: CleanupAllMemosOptions = {}): void {
  const { notify: shouldNotify = true } = options;
  // 沿原型链上溯：装饰器成员可能定义在任意基类上，只扫直接原型
  // 会漏掉继承的清理方法（#221）。
  // getOwnPropertyNames 不含 symbol 键 —— symbol 命名的 @Memo getter
  // 若漏扫，其 reaction 在 destroy 后仍然存活并继续被调度。
  const seen = new Set<string | symbol>();
  const cleanedKeys: (string | symbol)[] = [];
  let current = Object.getPrototypeOf(instance);
  while (current && current !== Object.prototype) {
    const ownKeys: (string | symbol)[] = [
      ...Object.getOwnPropertyNames(current),
      ...Object.getOwnPropertySymbols(current),
    ];
    for (const propertyName of ownKeys) {
      if (seen.has(propertyName)) {
        continue;
      }
      seen.add(propertyName);
      // String() 而非模板字符串：symbol 的隐式字符串转换会抛 TypeError
      const cleanupMethodName = `__cleanup_memo_${String(propertyName)}`;
      if (typeof instance[cleanupMethodName] === 'function') {
        instance[cleanupMethodName]();
        cleanedKeys.push(propertyName);
      }
    }
    current = Object.getPrototypeOf(current);
  }

  // 全部清理完成后再统一通知：与 invalidateMemo (#199) 的语义对齐，
  // 挂载中的外层 observer 能读到重置后的新值 (#255)；batch 合并为一次
  // 冲刷，读多个 memo 的 reaction 不会因每个 key 各重跑一次。
  if (shouldNotify && cleanedKeys.length > 0) {
    // flush 会重抛首个 reaction 错误 —— 但清理/teardown API 必须免抛：
    // 挂载中 observer 的异常属于 UI 层，不得让 teardown 半途而废
    // （与 #212 的「绝不替换在途异常」同一原则，方向相反）。
    try {
      batch(() => {
        for (const key of cleanedKeys) {
          notify(instance, key);
        }
      });
    } catch (error) {
      try {
        console.warn(
          '[rabjs/service] cleanupAllMemos: 通知阶段有 reaction 抛错（清理本身已完成）',
          error
        );
      } catch {
        // 日志失败同样不得影响调用方
      }
    }
  }
}
