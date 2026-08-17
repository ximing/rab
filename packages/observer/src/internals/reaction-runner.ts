// reactions can call each other and form a call stack
import { rawToOptions } from "./proxy-raw-map";
import {
  getReactionsForOperation,
  registerReactionForOperation,
  releaseReaction,
} from "./reaction-track";
import { Stack } from "./stack";
import type { Operation, Reaction } from "./types";

/*
 * 用于追踪当前正在执行的 reaction
 * 支持嵌套调用(一个 reaction 内部可能触发另一个 reaction)
 * 栈顶的 reaction 就是"当前正在运行的 reaction"
 * */
const reactionStack = new Stack<Reaction>();

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
    options &&
      options.reactionHandlers &&
      options.reactionHandlers.transformReactions
  );
  if (hasTransformReactions) {
    return true;
  }
  const reactions = getReactionsForOperation(operation);
  for (const reaction of reactions) {
    if (reaction.debugger) {
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
    // 每次执行前,清除该 reaction 之前建立的所有依赖关系 (obj -> key -> reactions)
    // 因为这次执行可能访问不同的属性,需要重新建立依赖
    releaseReaction(reaction);

    try {
      // 将 reaction 推入栈顶,标记为"当前正在运行"
      // 执行原始函数 fn
      // 在执行期间,任何对 observable 属性的访问都会被追踪到这个 reaction  (observable.prop -> reaction)
      reactionStack.push(reaction);
      return Reflect.apply(fn, context, args) as R;
    } finally {
      // 无论执行成功还是失败,都要将 reaction 从栈中移除
      reactionStack.pop();
    }
  }
  return undefined;
}

/*
 * 在属性访问时,将当前正在运行的 reaction 注册为该属性的依赖。
 * 在 Proxy 的 get trap 中被调用
 * */
export function registerRunningReactionForOperation(
  operation: Operation
): void {
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
    options &&
      options.reactionHandlers &&
      options.reactionHandlers.transformReactions
  );
  // 性能优化: 最常见的写操作是"修改没有任何依赖的属性",
  // 此时不 spread 空集合、不分配数组, 直接返回。
  // (配置了 transformReactions 时不早退 —— 自定义 handler 可能从空集补充 reactions)
  if (reactions.size === 0 && !hasTransformReactions) {
    return;
  }
  let reactionsArray = [...reactions];
  if (hasTransformReactions && options && options.reactionHandlers) {
    reactionsArray = options.reactionHandlers.transformReactions(
      target,
      key,
      reactionsArray
    );
  }

  // 性能优化: 使用 for 循环代替 forEach,避免函数调用开销
  if (Array.isArray(reactionsArray)) {
    const length = reactionsArray.length;
    // 优化: 提前检查 reactionStack 是否为空,避免重复调用 has()
    const stackSize = reactionStack.size;
    // 单个 reaction(或其 scheduler 调用)抛错不得中断同批其余 reaction;
    // 收集本批第一个错误,全部执行完毕后在变更调用点 rethrow。
    // 异步执行的错误(如 setTimeout 里的 reaction)天然不经过这里。
    let firstError: unknown;
    let hasError = false;
    for (let i = 0; i < length; i++) {
      const reaction = reactionsArray[i];
      // 栈不为空时,需要检查当前的 reaction 是否在栈中，在栈中，就不要重复触发
      // 这里的策略和mobx保持一致，是为了避免类似 array.sort() 的操作导致 在render 过程中 触发set
      // 这里把整个链路都排除了，但是可能出现一个问题，就是父节点已经渲染过的组件，如果这个arr有变化，就无法重新渲染了
      // 但是这种属于不正当用法才能出现的case，正常情况下，我们不应该在render中做set操作
      if (stackSize === 0 || !reactionStack.has(reaction)) {
        debugOperation(reaction, operation);
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
        try {
          if (typeof reaction.scheduler === "function") {
            reaction.scheduler(reaction);
          } else if (
            typeof reaction.scheduler === "object" &&
            reaction.scheduler !== null
          ) {
            reaction.scheduler.add(reaction);
          } else {
            reaction();
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
      throw firstError;
    }
  }
}

/*
 * 调用 reaction 的调试器,记录操作信息。
 * */
function debugOperation(reaction: Reaction, operation: Operation): void {
  if (reaction.debugger && !isDebugging) {
    try {
      isDebugging = true;
      reaction.debugger(operation);
    } finally {
      isDebugging = false;
    }
  }
}
