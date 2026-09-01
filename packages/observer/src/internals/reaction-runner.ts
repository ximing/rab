// reactions can call each other and form a call stack
import { proxyToRaw, rawToOptions } from './proxy-raw-map';
import {
  getReactionsForOperation,
  registerReactionForOperation,
  releaseReaction,
  restoreReaction,
} from './reaction-track';
import { Stack } from './stack';
import type { Operation, Reaction } from './types';
import { toRawIfProxy } from './utils';

/*
 * 用于追踪当前正在执行的 reaction
 * 支持嵌套调用(一个 reaction 内部可能触发另一个 reaction)
 * 栈顶的 reaction 就是"当前正在运行的 reaction"
 * */
const reactionStack = new Stack<Reaction>();

/*
 * untracked() 的嵌套深度。>0 时所有读取不注册依赖、不进入任何
 * reaction 的 debugger（MobX untracked 语义）。深度计数而非屏蔽
 * reaction：不需要伪造 reaction 压栈，热路径只多一次整数比较。
 * */
let untrackedDepth = 0;

/**
 * 以不追踪方式执行回调：回调内对 observable 的读取不注册为任何
 * reaction 的依赖（包括当前正在运行的外层 reaction），返回回调返回值。
 * 仅覆盖同步执行窗口 —— 回调内异步续段的读取不在保护范围内。
 */
export function untracked<T>(fn: () => T): T {
  untrackedDepth++;
  try {
    return fn();
  } finally {
    untrackedDepth--;
  }
}

/*
 * 防止调试器本身触发无限递归
 * 确保调试代码不会被重复执行
 * */
let isDebugging = false;

/*
 * #10: clear() 通知前为 operation.oldValue 做全量拷贝 (new Map(target)) 是
 * 热路径 O(n) 开销, 而 oldValue 的唯一消费者是 reaction.debugger
 * (如 @rabjs/react 的 debuggerReaction)。本函数判断一次操作是否会到达
 * 任何 debugger —— 只有会到达时, clear 才值得付拷贝成本。
 * */
export function hasOperationOldValueConsumer(operation: Operation): boolean {
  // transformReactions 可能向通知集补充带 debugger 的 reaction,
  // 无法静态判断, 保守视为存在消费者。
  const options = rawToOptions.get(operation.target);
  const hasTransformReactions = Boolean(
    options && options.reactionHandlers && options.reactionHandlers.transformReactions
  );
  if (hasTransformReactions) {
    return true;
  }
  const reactions = getReactionsForOperation(operation);
  for (const reaction of reactions) {
    // debugger 可显式声明 wantsOldValue === false（如 @rabjs/service 的
    // @Memo 同步失效钩子只看 operation.type）—— 不消费 oldValue 的
    // debugger 不值得让 clear 付 O(n) 快照成本。未声明时保持兼容：
    // 视为可能消费。
    if (
      reaction.debugger &&
      (reaction.debugger as { wantsOldValue?: boolean }).wantsOldValue !== false
    ) {
      return true;
    }
  }
  return false;
}

/*
 * 将一个普通函数作为 reaction 执行,并在执行期间建立依赖追踪。
 * */
export function runAsReaction<T extends Function, R>(
  reaction: Reaction,
  fn: T,
  context: unknown,
  args: ArrayLike<unknown>
): R | undefined {
  // 如果 reaction 已经被 unobserve(),仍执行函数,但不建立任何依赖关系。
  // 必须把它压入 reactionStack: 若裸执行, 而它又被另一个正在运行的 reaction
  // 手动调用, 其读取会经 registerRunningReactionForOperation 注册到外层栈顶
  // reaction 上, 导致存活的外层 reaction 被它从未读过的 key 误触发。
  // 压栈后读取归属 unobserved reaction 自身 (栈顶), 注册逻辑对其跳过
  // (见下方 registerRunningReactionForOperation), 顶层与嵌套行为一致。
  if (reaction.unobserved) {
    try {
      reactionStack.push(reaction);
      return Reflect.apply(fn, context, args) as R;
    } finally {
      reactionStack.pop();
    }
  }

  // 检查 reaction 是否已在调用栈中
  // 如果已存在,不再执行(防止无限递归)
  // 未来可能支持显式的递归 reactions
  if (!reactionStack.has(reaction)) {
    // 是否为该 reaction 的首次执行 (observe 首跑或 lazy 手动首跑)
    const firstRun = !reaction.everRan;
    // 重跑前快照上次成功运行的连接。仍先 release 再跑（通知查找发生在
    // 进入本函数之前，调度时序不变）；失败时再 restore，避免只留下抛错
    // 点之前读到的部分依赖 (#213)。
    // releaseReaction 不原地修改旧数组（forEach 删除后直接重新赋值为新
    // 数组），因此持有引用即为合法快照，无需 slice 拷贝——否则每次重跑
    // 都在热路径上白付一次 O(deps) 分配。firstRun 时它是空数组（observe
    // 创建时已初始化 cleaners），且失败走 firstRun 自动脱管分支，到不了 restore。
    const prevCleaners = reaction.cleaners ?? [];
    // 每次执行前,清除该 reaction 之前建立的所有依赖关系 (obj -> key -> reactions)
    // 因为这次执行可能访问不同的属性,需要重新建立依赖
    releaseReaction(reaction);

    try {
      // 将 reaction 推入栈顶,标记为"当前正在运行"
      // 执行原始函数 fn
      // 在执行期间,任何对 observable 属性的访问都会被追踪到这个 reaction  (observable.prop -> reaction)
      reactionStack.push(reaction);
      const result = Reflect.apply(fn, context, args) as R;
      reaction.everRan = true;
      return result;
    } catch (error) {
      if (firstRun) {
        // 首次执行抛错: reaction 处于"半成品"状态 —— 抛错前注册的部分依赖
        // 还在 connectionStore 里, 而调用者拿到异常后自然认为它已失败,
        // 无人再 unobserve 它, 后续每次写入都会复活这个僵尸 reaction。
        // 首跑失败即自动脱管 (标记 unobserved + 释放全部依赖连接), 再上抛。
        // 注意与重跑语义的区分: 已成功跑过的 reaction 在后续重跑中抛错
        // (G4 错误隔离范畴) 保持存活 —— 临时性错误不杀死活着的 reaction，
        // 并把依赖回滚到上次成功运行的集合。
        reaction.unobserved = true;
        releaseReaction(reaction);
      } else if (!reaction.unobserved) {
        restoreReaction(reaction, prevCleaners);
      }
      // 其余情况（!firstRun 且已 unobserved）：unobserve() 已原子完成
      // unobserved=true + releaseReaction，且 registerRunningReactionForOperation
      // 在 unobserved 后拒绝新注册，无依赖可清理。
      throw error;
    } finally {
      // 无论执行成功还是失败,都要将 reaction 从栈中移除
      reactionStack.pop();
    }
  }
  return undefined;
}

/*
 * 内部用：返回当前正在执行的 reaction（无则 null）。
 * 供上层（如 @rabjs/service 的链式 @Memo）判定一次读取归属于哪个
 * reaction 的计算窗口 —— 同步嵌套执行的其他 reaction 不得冒名。
 * */
export function getRunningReaction(): Reaction | null {
  return reactionStack.peek() ?? null;
}

/*
 * 在属性访问时,将当前正在运行的 reaction 注册为该属性的依赖。
 * 在 Proxy 的 get trap 中被调用
 * */
export function registerRunningReactionForOperation(operation: Operation): void {
  // untracked() 窗口内的读取对响应式系统完全不可见：
  // 不注册依赖，也不投递给任何 reaction 的 debugger
  if (untrackedDepth > 0) {
    return;
  }
  // 从 reactionStack 栈顶获取当前正在执行的 reaction
  // 如果栈为空(没有 reaction 在运行),则不做任何事
  const runningReaction = reactionStack.peek();
  if (runningReaction) {
    // 如果 reaction 有 debugger,记录这次操作
    debugOperation(runningReaction, operation);
    // reaction 在自身运行中被 unobserve() 后, 不再为其建立新依赖:
    // unobserve 已调用 releaseReaction 清掉既有连接, 若继续注册,
    // 后续写入会"复活"已 unobserve 的 reaction, 且这些新连接无人释放
    // (reaction 已脱管, cleaners 不会再被遍历), entry 永久搁浅。
    if (runningReaction.unobserved) {
      return;
    }
    // 调用 registerReactionForOperation 建立 (target.key -> reaction) 的映射
    // 存储在 connectionStore 中(来自 store.js)
    registerReactionForOperation(runningReaction, operation);
  }
}

/*
 * MobX 式 batch/transaction (issue #93):
 * 变更期间把待触发的 reaction 收进去重队列, 最外层 batch 结束时统一 flush。
 * 嵌套 batch 只在 depth 回到 0 时 flush。batch 外的单次赋值仍立即同步执行
 * (不改默认调度语义)。数组变异方法 (push/pop/splice/...) 在 get trap 里
 * 被包进 batch, 一次方法调用内部的多条 trap 写入只通知每个 reaction 一次。
 * */
let batchDepth = 0;
let isFlushing = false;
const pendingReactionSet = new Set<Reaction>();
const pendingReactions: Reaction[] = [];
let flushHasError = false;
let flushFirstError: unknown;

function recordFlushError(error: unknown): void {
  if (!flushHasError) {
    flushHasError = true;
    flushFirstError = error;
  }
}

function throwFlushErrorIfAny(): void {
  if (!flushHasError) {
    return;
  }
  const error = flushFirstError;
  flushHasError = false;
  flushFirstError = undefined;
  throw error;
}

/**
 * 把一段同步变更收成一批: 同一 reaction 去重, 结束后统一触发。
 * 嵌套调用安全; 回调的返回值原样传出。
 */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  let fnError: unknown;
  let hasFnError = false;
  try {
    return fn();
  } catch (error) {
    hasFnError = true;
    fnError = error;
    throw error;
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      // flush 抛出的错误不得覆盖回调自身的在途异常（#212）：
      // finally 中抛出新错误会按 JS 语义替换原始异常，调用方 catch 到的
      // 会是 reaction 的错误、自己的错误被静默吞掉。回调抛错时优先重抛
      // 原始异常，flush 错误在原始异常是 Error 且尚无 cause 时附加为 cause。
      try {
        flushQueuedReactions();
      } catch (flushError) {
        if (!hasFnError) {
          throw flushError;
        }
        // Error.cause 需要 es2022 lib，这里用窄化断言访问以兼容现有 target
        const fnErrorWithCause = fnError as Error & { cause?: unknown };
        let attached = false;
        // 回调和 reaction 抛的是同一个值/同一个 Error 实例：flush 错误
        // 就是要重抛的回调异常本身 —— 没有错误被丢弃，既不需要附加
        // cause 也不允许走到下方 warn 的误报路径（严格 console 环境会
        // 因此误 fail）。
        if (flushError === fnError) {
          attached = true;
        } else if (
          fnError instanceof Error &&
          flushError instanceof Error &&
          fnErrorWithCause.cause === undefined
        ) {
          try {
            fnErrorWithCause.cause = flushError;
            attached = true;
          } catch {
            // 回调的错误对象被冻结/不可扩展时，strict mode 下赋值 cause
            // 自身会抛 TypeError —— 绝不允许它替换回调的在途异常，
            // 否则 #212 的错误掩蔽会以另一种形式回归。
          }
        }
        if (!attached) {
          // flush 错误无法附加到回调异常（回调抛非 Error / 已有 cause /
          // 错误对象被冻结）。不静默吞掉 reaction 的失败堆栈——它是定位
          // 「状态变了但副作用失败」的唯一线索。
          // console.warn 自身必须被隔离：jest-fail-on-console 等严格 console
          // 环境会让 warn 抛错，若在 finally 的 catch 里炸掉会替换在途的
          // 回调异常——正是本函数要避免的 #212 掩蔽。
          try {
            console.warn(
              '[rabjs/observer] batch: a reaction error during flush could not be attached to the in-flight callback error and was dropped:',
              flushError
            );
          } catch {
            // 日志失败也不能影响在途异常
          }
        }
        throw fnError;
      }
    }
  }
}

const ARRAY_MUTATOR_KEYS = new Set([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
]);

const wrappedArrayMutators = new WeakMap<Function, Function>();

function wrapArrayMutator(fn: Function): Function {
  const cached = wrappedArrayMutators.get(fn);
  if (cached) {
    return cached;
  }
  const wrapped = function (this: unknown, ...args: unknown[]): unknown {
    return batch(() => Reflect.apply(fn, this, args));
  };
  Object.defineProperty(wrapped, 'name', { value: fn.name, configurable: true });
  Object.defineProperty(wrapped, 'length', { value: fn.length, configurable: true });
  wrappedArrayMutators.set(fn, wrapped);
  return wrapped;
}

/*
 * 数组变异方法经 get trap 取出时包进 batch, 使引擎方法内部的多条
 * [[Set]]/[[Delete]] 在一次用户调用里只 flush 一轮。非数组 / 非变异
 * 方法名原样返回, 热路径 (索引读) 不受影响。
 */
export function wrapIfArrayMutator(target: object, key: PropertyKey, value: unknown): unknown {
  if (
    typeof value === 'function' &&
    typeof key === 'string' &&
    ARRAY_MUTATOR_KEYS.has(key) &&
    Array.isArray(target)
  ) {
    return wrapArrayMutator(value);
  }
  return value;
}

function scheduleReaction(reaction: Reaction): void {
  /*
   * 根据 reaction 的调度策略,决定如何执行该 reaction。
   * 函数类型 scheduler:
   * observe(fn, {
   *    scheduler: (reaction) => {
   *      setTimeout(reaction, 0) // 异步执行
   *    }
   * })
   * 对象类型 scheduler (如 Set/Queue):
   * observe(fn, {
   *    scheduler: new Set() // 批量收集,稍后统一执行
   * })
   * 无 scheduler: 立即同步执行
   * observe(fn) // 默认同步执行
   * */
  if (typeof reaction.scheduler === 'function') {
    reaction.scheduler(reaction);
  } else if (typeof reaction.scheduler === 'object' && reaction.scheduler !== null) {
    reaction.scheduler.add(reaction);
  } else {
    reaction();
  }
}

function runQueuedReaction(reaction: Reaction): void {
  if (reaction.unobserved) {
    return;
  }
  if (reactionStack.has(reaction)) {
    return;
  }
  try {
    scheduleReaction(reaction);
  } catch (error) {
    recordFlushError(error);
  }
}

function flushQueuedReactions(): void {
  if (isFlushing) {
    return;
  }
  isFlushing = true;
  try {
    while (pendingReactions.length > 0) {
      const list = pendingReactions.splice(0);
      pendingReactionSet.clear();
      for (let i = 0; i < list.length; i++) {
        runQueuedReaction(list[i]);
      }
    }
  } finally {
    isFlushing = false;
    throwFlushErrorIfAny();
  }
}

/*
 * 手动通知依赖 target.key 的 reactions。
 * accessor / @Memo 这类没有落盘 set 的属性在依赖变化后需要唤醒外层 observe。
 * 传入 proxy 或 raw 均可（target 与 key 都做解包：集合 trap 入口按 raw 身份
 * 归一化注册，key 不解包会落在一个全新的 WeakRef 上，静默漏通知 #214）。
 * key 可以是属性名，也可以是 Map/Set 的 object/function key。
 * */
export function notify(target: object, key: PropertyKey | object): void {
  const rawTarget = (proxyToRaw.get(target) as object) || target;
  queueReactionsForOperation({
    target: rawTarget,
    // 集合 trap 同样把 object key as PropertyKey 写入 Operation
    key: toRawIfProxy(key) as PropertyKey,
    type: 'set',
  });
}

/*
 * 作用: 当数据发生变化时,找出所有依赖该数据的 reactions 并触发它们。
 * 在 Proxy 的 set/delete/add/clear 等修改操作中被调用:
 * */
export function queueReactionsForOperation(operation: Operation): void {
  // iterate and queue every reaction, which is triggered by obj.key mutation
  const { target, key } = operation;
  const reactions = getReactionsForOperation(operation);
  // 允许用户通过自定义 handler 过滤或转换 reactions
  // 默认情况下直接返回原数组
  const options = rawToOptions.get(target);
  const hasTransformReactions = Boolean(
    options && options.reactionHandlers && options.reactionHandlers.transformReactions
  );
  // 性能优化: 最常见的写操作是"修改没有任何依赖的属性",
  // 此时不 spread 空集合、不分配数组, 直接返回。
  // (配置了 transformReactions 时不早退 —— 自定义 handler 可能从空集补充 reactions)
  if (reactions.size === 0 && !hasTransformReactions) {
    return;
  }
  let reactionsArray = [...reactions];
  if (hasTransformReactions && options && options.reactionHandlers) {
    reactionsArray = options.reactionHandlers.transformReactions(target, key, reactionsArray);
  }

  // 性能优化: 使用 for 循环代替 forEach,避免函数调用开销
  if (Array.isArray(reactionsArray)) {
    const length = reactionsArray.length;
    // 优化: 提前检查 reactionStack 是否为空,避免重复调用 has()
    const stackSize = reactionStack.size;
    const defer = batchDepth > 0 || isFlushing;
    // 单个 reaction(或其 scheduler 调用 / 其 debugger)抛错不得中断同批其余
    // reaction; 收集本批第一个错误,全部执行完毕后在变更调用点 rethrow。
    // 异步执行的错误(如 setTimeout 里的 reaction)天然不经过这里。
    // batch 期间错误先记到 flush 槽, 由最外层 batch 结束时再抛 —— 不能在
    // 单条 trap 里抛, 否则会打断 Array#splice 等引擎方法的剩余写入。
    let firstError: unknown;
    let hasError = false;
    for (let i = 0; i < length; i++) {
      const reaction = reactionsArray[i];
      // 栈不为空时,需要检查当前的 reaction 是否在栈中，在栈中，就不要重复触发
      // 这里的策略和mobx保持一致，是为了避免类似 array.sort() 的操作导致 在render 过程中 触发set
      // 这里把整个链路都排除了，但是可能出现一个问题，就是父节点已经渲染过的组件，如果这个arr有变化，就无法重新渲染了
      // 但是这种属于不正当用法才能出现的case，正常情况下，我们不应该在render中做set操作
      if (stackSize === 0 || !reactionStack.has(reaction)) {
        try {
          // debugger 单独隔离: throwing debugger 的错误并入首错收集,
          // 但不得吞掉本 reaction 自身的调度 (scheduler/reaction 仍要执行)
          try {
            debugOperation(reaction, operation);
          } catch (error) {
            if (!hasError) {
              hasError = true;
              firstError = error;
            }
          }
          if (defer) {
            if (!pendingReactionSet.has(reaction)) {
              pendingReactionSet.add(reaction);
              pendingReactions.push(reaction);
            }
          } else {
            scheduleReaction(reaction);
          }
        } catch (error) {
          if (!hasError) {
            hasError = true;
            firstError = error;
          }
        }
      }
    }
    if (hasError) {
      if (defer) {
        recordFlushError(firstError);
      } else {
        throw firstError;
      }
    }
  }
}

/*
 * 调用 reaction 的调试器,记录操作信息。
 * isDebugging 重入保护：debugger 自身写 observable 会让嵌套的
 * queueReactionsForOperation 再次进入本函数 —— 跳过以防无限递归。
 * 例外：debugger 上声明 reentrantSafe = true 的钩子（如 @Memo 的同步
 * 失效钩子，只翻转布尔标记、绝不写 observable）在重入窗口内仍然
 * 送达 —— 否则窗口内打在钩子依赖上的写会静默丢失失效记账，
 * 且没有任何 flush 兜底（钩子标记与 scheduler 的 dirtySinceCompute
 * 是同一信号源）。
 * */
function debugOperation(reaction: Reaction, operation: Operation): void {
  const debuggerFn = reaction.debugger;
  if (!debuggerFn) {
    return;
  }
  if (isDebugging && !debuggerFn.reentrantSafe) {
    return;
  }
  if (isDebugging) {
    // reentrantSafe：不重设 isDebugging（保持 true），钩子保证不写
    // observable，不会再生嵌套操作
    debuggerFn(operation);
    return;
  }
  try {
    isDebugging = true;
    debuggerFn(operation);
  } finally {
    isDebugging = false;
  }
}
