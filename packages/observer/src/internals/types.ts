export type OperationType = 'get' | 'has' | 'iterate' | 'add' | 'set' | 'delete' | 'clear';

export interface Operation {
  target: object;
  key: PropertyKey;
  type: OperationType;
  value?: unknown;
  oldValue?: unknown;
  receiver?: unknown;
}

export interface Reaction extends Function {
  cleaners: Set<Reaction>[];
  unobserved?: boolean;
  scheduler?: ReactionScheduler | Function;
  debugger?: (operation: Operation) => void;
}

export interface ReactionScheduler {
  add: (reaction: Reaction) => void;
  delete: (reaction: Reaction) => void;
}

export type Collection =
  | Map<unknown, unknown>
  | Set<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>;

export type ReactionHandler = (
  target: object,
  propertyKey: PropertyKey,
  reactions: Reaction[]
) => Reaction[];

export interface ReactionHandlers {
  transformReactions: ReactionHandler;
}

export interface ObservableOptions {
  proxyHandlers?: ProxyHandlers;
  collectionHandlers?: CollectionHandlers;
  reactionHandlers?: ReactionHandlers;
}
export interface IteratorResult<T> {
  done: boolean;
  value: T;
}

export interface PatchableIterator<T> {
  next: () => IteratorResult<T>;
}

/**
 * ProxyHandlers 定义了用于普通对象和数组的 Proxy handlers
 * 实现响应式系统的核心拦截逻辑:
 * - get: 拦截属性读取,建立依赖关系
 * - has: 拦截 in 操作符
 * - ownKeys: 拦截对象键的枚举操作
 * - set: 拦截属性设置,检测变化并触发 reactions
 * - deleteProperty: 拦截属性删除操作
 * - construct: 拦截 new 操作符,返回响应式实例
 */
export interface ProxyHandlers {
  /**
   * 拦截属性读取操作,建立依赖关系并返回响应式的值
   * @param target - 目标对象
   * @param key - 属性键
   * @param receiver - Proxy 或继承 Proxy 的对象
   * @returns 属性值(如果是对象则自动包装为 observable)
   */
  get(target: object, key: PropertyKey, receiver: unknown): unknown;

  /**
   * 拦截 in 操作符,建立依赖关系
   * @param target - 目标对象
   * @param key - 属性键
   * @returns 是否存在该属性
   */
  has(target: object, key: PropertyKey): boolean;

  /**
   * 拦截对象键的枚举操作(如 Object.keys, for...in),建立迭代依赖
   * @param target - 目标对象
   * @returns 对象的所有键(包括 Symbol 键)
   */
  ownKeys(target: object): PropertyKey[];

  /**
   * 拦截属性设置操作,检测变化并触发 reactions
   * @param target - 目标对象
   * @param key - 属性键
   * @param value - 新值
   * @param receiver - Proxy 或继承 Proxy 的对象
   * @returns 是否设置成功
   */
  set(target: object, key: PropertyKey, value: unknown, receiver: unknown): boolean;

  /**
   * 拦截属性删除操作,触发相关 reactions
   * @param target - 目标对象
   * @param key - 属性键
   * @returns 是否删除成功
   */
  deleteProperty(target: object, key: PropertyKey): boolean;

  /**
   * 拦截 new 操作符,返回响应式的实例
   * @param target - 构造函数
   * @param args - 构造函数参数
   * @param newTarget - new 命令作用的构造函数
   * @returns 响应式的实例对象
   */
  construct(target: object, args: ArrayLike<unknown>, newTarget: unknown): object;
}

export interface CollectionHandlers {
  has(this: Collection, key: unknown): boolean;
  get(this: Collection, key: unknown): unknown;
  add(this: Collection, key: unknown): Collection;
  set(this: Collection, key: unknown, value: unknown): Collection;
  delete(this: Collection, key: unknown): boolean;
  clear(this: Collection): void;
  forEach(
    this: Collection,
    callback: (value: unknown, key: unknown, map: Map<unknown, unknown>) => void,
    thisArg?: unknown
  ): void;
  keys(this: Collection): IterableIterator<unknown>;
  values(this: Collection): IterableIterator<unknown>;
  entries(this: Collection): IterableIterator<[unknown, unknown]>;
  [Symbol.iterator](this: Collection): IterableIterator<unknown>;
  size: number;
}
