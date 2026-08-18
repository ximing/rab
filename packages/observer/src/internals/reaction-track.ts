/*
 * 存储映射关系: observable 属性 ↔ reactions
 * 建立依赖: 记录哪个 reaction 依赖哪个属性
 * 查询依赖: 当属性变化时,快速找出需要触发的 reactions
 * 清理依赖: reaction 结束时,清理过期的依赖关系
 * */

import type { Operation, Reaction } from "./types";

type StoredKey = PropertyKey | symbol | WeakRef<object>;
type ConnectionMap = Map<StoredKey, Set<Reaction>>;

/*
 * 集合 (Map/Set/WeakMap/WeakSet) 的依赖注册会把用户传入的 key 对象
 * 存进 ConnectionMap。普通 Map 对 key 是强引用 —— 只要 observable 还活着,
 * key 对象就永远无法被 GC, 这对 WeakMap 使用者是语义破坏 (内存泄漏)。
 *
 * 修复: 对象 key 统一包装成 WeakRef 再存入 (每个 key 通过 side WeakMap
 * 缓存同一个 WeakRef 实例, 保证 Map 查找的恒等性)。Map 本身只强持有
 * WeakRef 包装对象 (几十字节), 不持有 key。
 * 遍历 (clear) 时发现 deref() 为 undefined 的死条目会顺手清除。
 *
 * 兼容: 旧 RN JSC 等无 WeakRef 的环境退化为原来的强持有行为。
 * */
const supportsWeakRef = typeof WeakRef === "function";
const keyToWeakRef: WeakMap<object, WeakRef<object>> | null = supportsWeakRef
  ? new WeakMap()
  : null;

function wrapKey(key: PropertyKey | symbol): StoredKey {
  if (!keyToWeakRef || typeof key !== "object" || key === null) {
    return key;
  }
  let ref = keyToWeakRef.get(key);
  if (!ref) {
    ref = new WeakRef(key);
    keyToWeakRef.set(key, ref);
  }
  return ref;
}

function isDeadRef(storedKey: StoredKey): boolean {
  return (
    typeof storedKey === "object" &&
    storedKey !== null &&
    storedKey instanceof WeakRef &&
    storedKey.deref() === undefined
  );
}

// connectionStore
// ├── observable1 (WeakMap key)
// │   └── Map {
// │       ├── 'count' → Set([reaction1, reaction2])
// │       ├── 'name' → Set([reaction3])
// │       └── ITERATION_KEY → Set([reaction4])
// │   }
const connectionStore = new WeakMap<object, ConnectionMap>();

/*
 * #12: Set → (所属 ConnectionMap, storedKey) 的反查表。
 * releaseReactionKeyConnection 只有 Set 本身 (reaction.cleaners 存的是 Set
 * 引用), 空集时需要借此找到并删除所属 Map entry, 否则空 Set 和 entry
 * 永久残留 (实测 5 万动态 key 约 10MB, ~200B/key)。
 * WeakMap 弱持有 Set, 不影响其 GC。
 * */
const setToOwner = new WeakMap<
  Set<Reaction>,
  { map: ConnectionMap; key: StoredKey }
>();

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
  // #6: 同一 raw 可能先后被 shadow 与 deep 两种代理初始化,
  // 不得重置已有连接表, 否则先建立的那一侧依赖会静默丢失。
  if (!connectionStore.has(obj)) {
    connectionStore.set(obj, new Map());
  }
}

/*
 * @internal 仅供测试使用的探针: 返回 target 当前有多少个 (key -> reactions) entry。
 * 用于验证空 entry 是否被正确清理 (#12)。
 * */
export function getConnectionsCount(target: object): number {
  return connectionStore.get(target)?.size ?? 0;
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

  let reactionsForKey = reactionsForObj.get(wrapKey(actualKey));
  if (!reactionsForKey) {
    reactionsForKey = new Set<Reaction>();
    reactionsForObj.set(wrapKey(actualKey), reactionsForKey);
    // #12: 记录该 Set 的归属, 供空集时清除 entry 使用
    setToOwner.set(reactionsForKey, {
      map: reactionsForObj,
      key: wrapKey(actualKey),
    });
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
     * 顺带清除已死的 WeakRef 条目 (key 对象已被 GC 的依赖残留)
     * */
    for (const [storedKey, _] of reactionsForTarget.entries()) {
      if (isDeadRef(storedKey)) {
        reactionsForTarget.delete(storedKey);
        continue;
      }
      addReactionsForKey(reactionsForKey, reactionsForTarget, storedKey);
    }
  } else {
    addReactionsForKey(reactionsForKey, reactionsForTarget, wrapKey(key));
    /*
     * 数组 length 收缩: 隐式删除的索引依赖也要通知。
     * 旧 length 必须用 trap 在赋值前捕获的 oldValue —— 通知发生在赋值之后,
     * target.length 已是新值, 用它近似旧 length 会漏掉非边界索引
     * (如 5→3 时读 arr[4] 的依赖)。
     * 新 length 用赋值后的 target.length: operation.value 可能是字符串
     * (arr.length = "3" 会被引擎合法转换) 或非整数, 不能作为数值依据。
     * 进入条件放宽为 "oldValue 是 number 且确实发生了收缩":
     * - 增长时 target.length >= oldValue, 不会误报;
     * - oldValue 不可用 (理论上不会发生, 防御性降级) 时跳过收缩分支;
     *   此时即使 fallback 到 target.length, target.length < target.length
     *   恒为 false, 行为与跳过完全等价, 因此直接选择更安全的 skip。
     * */
    if (
      Array.isArray(target) &&
      key === "length" &&
      type === "set" &&
      typeof operation.oldValue === "number" &&
      target.length < operation.oldValue
    ) {
      addReactionsForTruncatedArrayKeys(
        reactionsForKey,
        reactionsForTarget,
        operation.oldValue,
        target.length
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
    // symbol 不是数组索引 (Number(symbol) 会直接抛 TypeError), 必须先跳过。
    // 这同时覆盖了 ITERATION_KEY 之类的内部 symbol 键。
    if (typeof key === "symbol") {
      continue;
    }
    const index = Number(key);
    if (
      Number.isInteger(index) &&
      // 只匹配 canonical 数组索引: "03"、"-0"、"1e2" 这类奇异字符串
      // 会被 Number() 折叠成整数, 但它们是永远读 undefined 的普通属性,
      // length 收缩不影响其值, 误匹配会产生与依赖自身无关的假通知。
      String(index) === String(key) &&
      index >= newLength &&
      index < oldLength
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
  key: StoredKey
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
  // #12: Set 已空时把 entry 从所属 ConnectionMap 里删掉, 避免空 entry 永久残留。
  //
  // 安全性 (不会出现新旧 Set 分裂漏清理):
  // - entry 删除后, 后续同 key 再注册会从 Map 查不到 entry, 走新建 Set 的
  //   分支, reaction.cleaners 推入的是新 Set —— 旧 Set 不会复活;
  // - Set 变空意味着所有曾注册进它的 reaction 都已被 delete, 而每个
  //   reaction 的 delete 都发生在 releaseReaction 中 (随后其 cleaners 被
  //   置空), 因此旧 Set 此后不会再出现在任何 cleaners 里, 对它的再次
  //   delete 是无害的空操作;
  // - 下面的恒等防御检查确保 (理论上的) 脱落旧 Set 不会误删后来新注册的 entry。
  if (reactionsForKey.size === 0) {
    const owner = setToOwner.get(reactionsForKey);
    if (owner && owner.map.get(owner.key) === reactionsForKey) {
      owner.map.delete(owner.key);
    }
  }
}
