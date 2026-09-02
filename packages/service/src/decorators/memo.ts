import {
  observe,
  unobserve,
  notify,
  batch,
  raw,
  getRunningReaction,
  isUntracked,
} from '@rabjs/observer';
import type { Reaction, Operation } from '@rabjs/observer';

import { getOrCreateCleanupRegistry, findCleanup, runAllCleanups } from './cleanup-registry';

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
   * 本次计算期间读到的其它 memo 缓存（链式依赖 A→B），
   * 映射到「A 采纳该 dep 缓存时 dep 的版本号」。
   * debugger 钩子只按 reaction 的直接依赖做同步失效记账（#248），
   * 链式场景中 batch 内写 B 的底层依赖只会让 B.computed=false，
   * A 并不在写路径的反应集合里 —— 不带链校验的话，batch 中途读 A
   * 拿到的仍是旧缓存。每次计算前重置，只保留最新一轮的边。
   *
   * 版本快照的作用：链上 B 在 A 上次计算之后被重算过（version 前进），
   * 说明 A 的缓存采纳的是 B 的旧值，链校验必须判负 —— 仅靠
   * dep.computed 会把「B 重算过但 A 没有」误判为有效（陈旧缓存）。
   *
   * 弱持有的作用：CacheState 经 owner 字段与 reaction 闭包反持所属
   * 实例，强引用上游 CacheState 会让长寿命 memo（singleton service）
   * 把读过的 transient 上游实例保留到自己重算/销毁为止，架空
   * globalMemoCache 的 WeakMap 回收。支持 WeakRef 的环境弱持有，
   * 旧 RN JSC 等环境退化为强持有（与 observer reaction-track 同一取舍）。
   */
  memoDeps?: Map<MemoDepRef, number>;
  /** 链校验重入保护（环状 memo 引用本就属于未定义行为，校验不得自旋） */
  validating?: boolean;
  /**
   * 最近一次成功计算之后是否有写操作打在同步失效钩子上。
   * debugger 置位、computeValue 清除；flush 时的 scheduler 据此区分
   * 「待失效」与「mid-batch 已重算过」（见 scheduler 注释）。
   */
  dirtySinceCompute?: boolean;
  /**
   * 计算版本号，每次成功计算 +1。链上读取方在 memoDeps 里记录采纳时
   * 的版本；本版本与快照不一致即说明缓存已被上游重算甩在身后。
   */
  version?: number;
  /**
   * 所属实例（raw）与属性名 —— debugger 据此区分「直达依赖的写」与
   * 「链上 memo scheduler 的 notify」：后者不该标脏本缓存（见 debugger
   * 注释），只能由链校验/版本快照裁决。
   */
  owner?: object;
  key?: string | symbol;
}

/**
 * 全局缓存存储
 * 使用 WeakMap<实例, Map<属性名, 缓存状态>> 的结构
 * 这样所有 @Memo 装饰器共享一个 WeakMap，避免为每个 getter 创建独立的 WeakMap
 */
const globalMemoCache = new WeakMap<any, Map<string | symbol, CacheState>>();

/**
 * memo 清理注册表的 prototype 键（实现见 cleanup-registry.ts —
 * 以真实 propertyKey 为键，避免字符串化方法名的 symbol 撞名/漏扫）。
 */
const MEMO_CLEANUPS = Symbol('__rabjs_memo_cleanups__');

/**
 * 正在计算中的 memo 缓存（链式依赖采集用）。
 * memo A 的 reaction 运行期间读到另一个 memo B 的 getter 时，
 * 把 B 的 CacheState 记入 A.memoDeps（见 CacheState.memoDeps）。
 */
let collectingMemo: CacheState | null = null;

/*
 * 链式依赖边的弱持有（见 CacheState.memoDeps 注释）：支持 WeakRef 的
 * 环境以 WeakRef 包装上游 CacheState；无 WeakRef 的旧环境（RN JSC）
 * 退化为强引用。死引用在链校验时按「上游已失效」处理（保守重算）。
 */
const supportsWeakRef = typeof WeakRef === 'function';

type MemoDepRef = CacheState | WeakRef<CacheState>;

function wrapMemoDep(state: CacheState): MemoDepRef {
  return supportsWeakRef ? new WeakRef(state) : state;
}

function derefMemoDep(ref: MemoDepRef): CacheState | undefined {
  return supportsWeakRef ? (ref as WeakRef<CacheState>).deref() : (ref as CacheState);
}

/**
 * 把「读取方 collectingMemo 依赖了被读 memo state」这条边记下来，
 * 并快照被读 memo 当前的版本号（读取方采纳的就是这一版缓存）。
 *
 * 归属校验：只有 collecting memo 自己的 reaction 正在运行时，这次读取
 * 才构成它的链式边。getter 的计算窗口内可能同步执行其他 reaction
 * （如不纯 getter 写 observable 触发的即时 flush）—— 那些 reaction
 * 读到的 memo 不得记在 collecting memo 头上，否则制造假边：
 * 无关 memo 失效会强制本 memo 重算（不纯 getter 随之值漂移）。
 */
function recordMemoDep(state: CacheState): void {
  if (
    collectingMemo &&
    collectingMemo !== state &&
    // untracked() 窗口内的读取对响应式系统完全不可见（proxy get trap
    // 不注册依赖）——链式边记账必须遵守同一边界，否则用户显式放弃的
    // 依赖仍会让上游重算时链校验判负、强制本 memo 重算
    !isUntracked() &&
    getRunningReaction() === collectingMemo.reaction
  ) {
    (collectingMemo.memoDeps ??= new Map()).set(wrapMemoDep(state), state.version ?? 0);
  }
}

/**
 * 该写操作是不是打在「本 memo 链上的某个 memo getter」上的 notify。
 * memo getter 是 accessor，没有真实的 set 落盘 —— (owner, key) 上的
 * set 类 operation 只可能来自链上 memo scheduler 的 notify (#196)
 * 或 invalidateMemo/cleanupAllMemos 的手动 notify。
 */
function isChainNotifyOp(state: CacheState, operation: Operation): boolean {
  if (operation.type !== 'set') {
    return false;
  }
  const deps = state.memoDeps;
  if (!deps || deps.size === 0) {
    return false;
  }
  for (const depRef of deps.keys()) {
    const dep = derefMemoDep(depRef);
    if (dep && dep.owner === operation.target && dep.key === operation.key) {
      return true;
    }
  }
  return false;
}

/**
 * 链式缓存有效性校验：本 state 标记为 computed，且它上次计算读到的
 * 所有 memo 缓存也都 (递归地) 有效、且版本仍停留在读取方采纳的那版，
 * 缓存才可信任。
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
    for (const [depRef, adoptedVersion] of deps) {
      const dep = derefMemoDep(depRef);
      // dep 已被 GC（WeakRef 环境）：上游实例不复存在，缓存无从信任，
      // 保守判负触发重算 —— 重算会读取当前可达的上游并重建边
      if (!dep || !dep.computed || (dep.version ?? 0) !== adoptedVersion || !isChainValid(dep)) {
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
          // raw：reaction 依赖注册与 notify 的 operation.target 都是 raw
          // 实例，isChainNotifyOp 的匹配要以同一身份为准
          owner: raw(instance),
          key: propertyKey,
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
              // 版本前进：链上读取方靠版本快照察觉「上游已重算」
              state.version = (state.version ?? 0) + 1;
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
            // 只响应写操作即可避开。
            // reentrantSafe：钩子只翻转布尔标记、绝不写 observable —— 声明后
            // 在 isDebugging 重入窗口（用户 debugger 执行期间发生的嵌套写）
            // 内仍然送达；否则窗口内的失效记账会被重入保护静默丢弃，
            // dirtySinceCompute 与它是同一信号源，flush 时没有任何兜底。
            debugger: Object.assign(
              (operation: Operation) => {
                if (
                  operation.type === 'set' ||
                  operation.type === 'add' ||
                  operation.type === 'delete' ||
                  operation.type === 'clear'
                ) {
                  // 链上 memo 的 notify 不是失效依据：本 memo 上次计算采纳了
                  // 哪个版本的上游缓存，由 memoDeps 的版本快照记录 —— flush 时
                  // 若上游只是「mid-batch 重算过、值已被本 memo 采纳」，标脏会
                  // 丢弃那次重算（不纯 getter 前后发散 + 白付一次重复计算，
                  // 与 dirtySinceCompute 守卫同一类问题，只是隔了一层 notify）；
                  // 若上游真的变了（版本前进 / computed=false / 被清理），
                  // 读路径的 isChainValid 会判负并触发重算，不会漏失效。
                  if (isChainNotifyOp(state, operation)) {
                    return;
                  }
                  state.computed = false;
                  state.dirtySinceCompute = true;
                }
              },
              // 只看 operation.type，不消费 oldValue —— 避免本 hook 让
              // Map/Set clear() 背上 O(n) 旧值快照的热路径开销
              { wantsOldValue: false, reentrantSafe: true }
            ),
          }
        );
      }

      // 手动运行/重跑以收集最新依赖。
      // 同时采集本次计算读到的其它 memo 缓存（链式依赖边 + 版本快照）
      // —— 上一轮依赖可能已随分支变化失效，每轮重置。
      state.memoDeps = new Map();
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

      // 双保险：proxy get trap 已在 Reflect.get 之前注册 (target, key) 的
      // get 依赖（#247 根因修复），getter 抛错也不再丢注册；这里再经 has
      // trap 预注册一份 has 桶依赖，防未来 trap 顺序变动回退。
      // this 不是 proxy (如 raw 读取) 时无 trap，自然退化为空操作。
      Reflect.has(this, propertyKey);

      // 否则重新计算
      const result = computeValue(state, this);
      // 本次读取发生在另一个 memo 的计算中 —— 记录链式依赖边
      recordMemoDep(state);
      return result;
    };

    // 注册清理函数（以真实 propertyKey 为键，symbol 键不会撞名）
    const registry = getOrCreateCleanupRegistry(target, MEMO_CLEANUPS);
    if (!registry.has(propertyKey)) {
      registry.set(propertyKey, function (this: any) {
        const instanceCache = globalMemoCache.get(this);
        if (instanceCache) {
          const state = instanceCache.get(propertyKey);
          if (state) {
            // 标记失效：链上其它 memo 的 memoDeps 可能仍引用这个旧
            // CacheState —— 不标负的话 isChainValid 会把已被清理的
            // 上游误判为有效，让下游继续供出陈旧缓存
            state.computed = false;
            if (state.reaction) {
              unobserve(state.reaction);
              state.reaction = null;
            }
          }
          instanceCache.delete(propertyKey);

          // 如果该实例没有其他缓存了，清理整个实例的缓存
          if (instanceCache.size === 0) {
            globalMemoCache.delete(this);
          }
        }
      });
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
  const cleanup = findCleanup(instance, MEMO_CLEANUPS, propertyKey);
  if (cleanup) {
    cleanup.call(instance);
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
  // 沿原型链上溯收集各原型注册表里的清理函数：装饰器成员可能定义在
  // 任意基类上，只扫直接原型会漏掉继承的清理（#221）。注册表以真实
  // propertyKey 为键，symbol 键天然覆盖（不会像字符串化方法名那样
  // 漏扫或撞名）。
  const cleanedKeys = runAllCleanups(instance, MEMO_CLEANUPS);

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
