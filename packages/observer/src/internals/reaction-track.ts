/*
 * 存储映射关系: observable 属性 ↔ reactions
 * 建立依赖: 记录哪个 reaction 依赖哪个属性
 * 查询依赖: 当属性变化时,快速找出需要触发的 reactions
 * 清理依赖: reaction 结束时,清理过期的依赖关系
 * */

import type { Operation, Reaction } from "./types";

type ConnectionMap = Map<PropertyKey | symbol, Set<Reaction>>;

// connectionStore
// ├── observable1 (WeakMap key)
// │   └── Map {
// │       ├── 'count' → Set([reaction1, reaction2])
// │       ├── 'name' → Set([reaction3])
// │       └── ITERATION_KEY → Set([reaction4])
// │   }
const connectionStore = new WeakMap<object, ConnectionMap>();

/*
 * 作用: 用于标记"迭代操作"(如 for...of, forEach),用 Symbol 避免与真实的属性名冲突
 * */
const ITERATION_KEY = Symbol("iteration key");

/*
 * 迭代操作的依赖键必须与通知时的查找键一致,否则依赖永不触发:
 * - 普通对象: ownKeys trap 注册的依赖挂在 ITERATION_KEY 上,新增/删除属性时也按 ITERATION_KEY 查找
 * - 数组: 数组的 ownKeys 结果由 length 决定(索引键集合随 length 变化),
 *   注册和通知都统一使用 "length" 键,保证两者相交
 * */
export function iterationKeyFor(target: object): PropertyKey | symbol {
  return Array.isArray(target) ? "length" : ITERATION_KEY;
}

/*
 * 在 observable.js 中创建 observable 时调用
 * const state = observable({ count: 0, name: 'Alice' })
 * 执行后,connectionStore 的结构:
 * connectionStore.get(state) = Map {
 *   // 空的,等待后续添加依赖
 * }
 * */
export function storeObservable(obj: object): void {
  // 这个Map 将用于存储该 observable 的所有属性与 reactions 的映射 (obj.key -> reaction)
  connectionStore.set(obj, new Map());
}

/*
 * 建立一个 reaction 对某个属性的依赖关系。
 * 何时被调用: 在 reactionRunner.js 中,当 reaction 访问 observable 属性时
 * */
export function registerReactionForOperation(
  reaction: Reaction,
  { target, key, type }: Operation
): void {
  // 处理迭代操作(如 for...of, forEach)时,使用特殊的迭代键
  // 数组用 "length"(见 iterationKeyFor 的说明),其他对象用 ITERATION_KEY
  // 其他操作(如 get, set)使用普通的属性键 key
  let actualKey: PropertyKey | symbol = key;
  if (type === "iterate") {
    actualKey = iterationKeyFor(target);
  }

  const reactionsForObj = connectionStore.get(target);
  if (!reactionsForObj) {
    return;
  }

  let reactionsForKey = reactionsForObj.get(actualKey);
  if (!reactionsForKey) {
    reactionsForKey = new Set<Reaction>();
    reactionsForObj.set(actualKey, reactionsForKey);
  }

  if (!reactionsForKey.has(reaction)) {
    reactionsForKey.add(reaction);
    // 记录该 reaction 对该属性的依赖关系,用于后续清理
    reaction.cleaners.push(reactionsForKey);
  }
}

/*
 * 作用: 查询某个操作会触发哪些 reactions。
 * */
export function getReactionsForOperation(
  operation: Operation
): Set<Reaction> {
  const { target, key, type } = operation;
  const reactionsForTarget = connectionStore.get(target);
  const reactionsForKey = new Set<Reaction>();

  if (!reactionsForTarget) {
    return reactionsForKey;
  }

  if (type === "clear") {
    /*
     * 清空集合时,需要触发所有属性的 reactions, 遍历所有 key,收集它们的 reactions
     * */
    for (const [key, _] of reactionsForTarget.entries()) {
      addReactionsForKey(reactionsForKey, reactionsForTarget, key);
    }
  } else {
    addReactionsForKey(reactionsForKey, reactionsForTarget, key);
    // 数组 length 收缩: 隐式删除的索引依赖也要通知 (value 为收缩后的新 length)
    if (
      Array.isArray(target) &&
      key === "length" &&
      type === "set" &&
      typeof operation.value === "number"
    ) {
      addReactionsForTruncatedArrayKeys(
        reactionsForKey,
        reactionsForTarget,
        target.length + 1, // 近似旧 length; 多收集一些索引键是安全的(没有依赖的键查不到 reactions)
        operation.value
      );
    }
  }

  if (type === "add" || type === "delete" || type === "clear") {
    addReactionsForKey(
      reactionsForKey,
      reactionsForTarget,
      iterationKeyFor(target)
    );
  }

  return reactionsForKey;
}

/*
 * 数组 length 收缩时,被截断的索引(>= newLength)的依赖也必须被通知,
 * 否则直接读取 arr[i] 的 reaction 会读到已删除的脏数据。
 * 原生数组语义下 length 收缩会隐式删除这些索引,因此这里把它们的依赖一并收集。
 * */
function addReactionsForTruncatedArrayKeys(
  reactionsForKey: Set<Reaction>,
  reactionsForTarget: ConnectionMap,
  oldLength: number,
  newLength: number
): void {
  for (const key of reactionsForTarget.keys()) {
    const index = Number(key);
    if (
      Number.isInteger(index) &&
      index >= newLength &&
      index < oldLength &&
      key !== ITERATION_KEY
    ) {
      addReactionsForKey(reactionsForKey, reactionsForTarget, key);
    }
  }
}

/*
 * 作用: 辅助函数,用于向 reactionsForKey 集合添加指定 key 对应的 reactions。
 * */
function addReactionsForKey(
  reactionsForKey: Set<Reaction>,
  reactionsForTarget: ConnectionMap,
  key: PropertyKey | symbol
): void {
  // 如果该 key 有 reactions,将它们全部添加到结果集合中
  // 使用 Set.forEach 的第二个参数作为 this 上下文
  const reactions = reactionsForTarget.get(key);

  reactions && reactions.forEach(reactionsForKey.add, reactionsForKey);
}

/*
 * 清理一个 reaction 的所有依赖关系。
 * 何时被调用:
 * 1. reaction 重新执行时  (在 reactionRunner.js 中):
 * 2. reaction 被取消观察时 (在 observer.js 中)
 * */
export function releaseReaction(reaction: Reaction): void {
  if (reaction.cleaners) {
    reaction.cleaners.forEach(releaseReactionKeyConnection, reaction);
  }
  reaction.cleaners = [];
}

function releaseReactionKeyConnection(
  this: Reaction,
  reactionsForKey: Set<Reaction>
): void {
  reactionsForKey.delete(this);
}
