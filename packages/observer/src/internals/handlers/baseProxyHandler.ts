/*
 * 定义了用于普通对象和数组的 Proxy handlers,实现:
 * 1. 读取拦截: 追踪属性访问,建立依赖关系
 * 2. 写入拦截: 检测属性变化,触发相关 reactions
 * 3. 深度响应式: 自动包装嵌套对象为 observable
 * 4. 边界处理: 处理特殊情况(Symbol、不可配置属性、原型链等)
 * */
import { observable } from '../observable';
import { observableChild } from '../observableChild';
import { proxyToRaw } from '../proxyRawMap';
import { queueReactionsForOperation, registerRunningReactionForOperation } from '../reactionRunner';
import { hasOwnProperty, isObject } from '../utils';

/*
 * 存储所有内置的 Symbol(如 Symbol.iterator, Symbol.toStringTag 等)
 * 为什么需要?
 * 这些 Symbol 是 JavaScript 内部使用的
 * 不应该追踪它们的访问,否则会导致性能问题和意外行为
 * 例如: Symbol.iterator 在 for...of 循环中会被频繁访问
 * */
const wellKnownSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key as keyof SymbolConstructor])
    .filter(value => typeof value === 'symbol')
);

// 拦截属性读取操作,建立依赖关系并返回响应式的值。
function get(target: object, key: PropertyKey, receiver: unknown): unknown {
  // 调用 Reflect.get(target, key, receiver) 获取原始值
  const result = Reflect.get(target, key, receiver);
  if (typeof key === 'symbol' && wellKnownSymbols.has(key)) {
    return result;
  }
  // 如果当前有 reaction 在运行,建立 (target.key -> reaction) 的依赖
  registerRunningReactionForOperation({ target, key, receiver, type: 'get' });

  // 处理不可配置且不可写的属性
  // Proxy 有一个不变式(invariant):
  // 如果属性是不可配置且不可写的,Proxy 的 get trap 必须返回与目标对象相同的值
  // 否则会抛出 TypeError
  /*
   * const obj = {}
   * Object.defineProperty(obj, 'frozen', {
   *   value: 42,
   *   writable: false,
   *   configurable: false
   *   })
   * const proxy = new Proxy(obj, {
   *   get(target, key) {
   *     return 100  // ❌ TypeError: 'get' on proxy: property 'frozen' is a read-only and non-configurable data property
   *   }
   * })
   * */
  const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
  if (descriptor && descriptor.writable === false && descriptor.configurable === false) {
    return result;
  }

  // 如果返回值是对象,自动包装为 observable 实现深度响应式
  return observableChild(result, target);
}

// 作用: 拦截 in 操作符,建立依赖关系。
function has(target: object, key: PropertyKey): boolean {
  const result = Reflect.has(target, key);
  registerRunningReactionForOperation({ target, key, type: 'has' });
  return result as boolean;
}

// 拦截对象键的枚举操作,建立迭代依赖。
function ownKeys(target: object): PropertyKey[] {
  registerRunningReactionForOperation({ target, key: '', type: 'iterate' });
  return Reflect.ownKeys(target);
}

// 截属性设置操作,检测变化并触发 reactions。
function set(target: object, key: PropertyKey, value: unknown, receiver: unknown): boolean {
  // const state1 = observable({ count: 0 })
  // const state2 = observable({ data: null })
  // state2.data = state1  // 如果不解包,会存储 Proxy 对象
  // 解包后:
  // state2 的原始对象存储的是 state1 的原始对象
  // 而不是 state1 的 Proxy
  if (isObject(value)) {
    value = proxyToRaw.get(value) || value;
  }
  // 判断是新增属性还是修改属性
  const hadKey = hasOwnProperty.call(target, key);
  // 用于比较值是否真的改变了
  const oldValue = (target as Record<PropertyKey, unknown>)[key];
  // 先执行赋值操作, 再触发 reactions, 确保 reactions 看到的是新值
  const result = Reflect.set(target, key, value, receiver);
  // 如果操作的目标不是原始接收器，则不要 queue reactions
  // 这是因为原型继承，当原型具有setter时，设置操作会遍历整个原型链，并在每个对象上调用设置 trap，直到找到setter
  // 而不是直接在当前对象上设置属性
  // 这会导致在原型链上的所有对象上触发reactions,而不仅仅是当前对象
  // 这是不期望的, 我们只需要在当前对象上触发reactions即可
  /*
  * const parent = observable({ count: 0 })
  * const child = observable(Object.create(parent))
  * observe(() => {
  *   console.log(child.count)
  * })
  * child.count = 1
    // 执行流程:
    // 1. child 的 set trap 被调用
    //    - target = child 的原始对象
    //    - receiver = child 的 Proxy
    //    - child 没有 count 属性,继续查找原型链
    // 2. parent 的 set trap 被调用
    //    - target = parent 的原始对象
    //    - receiver = child 的 Proxy (注意!)
    //    - target !== proxyToRaw.get(receiver)
    //    - 不触发 reactions,避免重复
    // 只在 child 的 set trap 中触发 reactions
  * */
  if (typeof receiver === 'object' && receiver !== null && target !== proxyToRaw.get(receiver)) {
    return result as boolean;
  }
  if (!hadKey) {
    // 新增属性，会触发依赖 ITERATION_KEY 的 reactions(因为键集合改变了)
    queueReactionsForOperation({ target, key, value, receiver, type: 'add' });
  } else if (value !== oldValue) {
    // 修改属性
    queueReactionsForOperation({
      target,
      key,
      value,
      oldValue,
      receiver,
      type: 'set',
    });
  }
  return result as boolean;
}

/*
 * 拦截属性删除操作,触发相关 reactions。
 * */
function deleteProperty(target: object, key: PropertyKey): boolean {
  // 记录旧状态
  const hadKey = hasOwnProperty.call(target, key);
  const oldValue = (target as Record<PropertyKey, unknown>)[key];
  // 执行删除操作
  const result = Reflect.deleteProperty(target, key);
  // 只有属性确实存在时才触发,会触发依赖该属性的 reactions
  // 也会触发依赖 ITERATION_KEY 的 reactions(键集合改变)
  if (hadKey) {
    queueReactionsForOperation({ target, key, oldValue, type: 'delete' });
  }
  return result as boolean;
}

// 拦截 new 操作符,返回响应式的实例。
function construct(target: object, args: ArrayLike<unknown>, newTarget: unknown): object {
  let nt = newTarget;
  if (typeof newTarget === 'object' && newTarget !== null) {
    // 确保 instance instanceof Child 为 true
    if (proxyToRaw.has(newTarget)) {
      nt = proxyToRaw.get(newTarget);
    }
  }
  const result = Reflect.construct(target as Function, Array.from(args), nt as Function);
  if (typeof result === 'object' && result !== null) {
    return observable(result) as object;
  }
  return result as object;
}

export const baseProxyHandler = { get, has, ownKeys, set, deleteProperty, construct };
