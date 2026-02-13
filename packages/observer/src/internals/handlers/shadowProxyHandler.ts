/*
 * 浅层响应式代理处理器
 * 只在根级别提供响应式能力，不会对嵌套对象进行深层转换
 * 属性的值会被原样存储和暴露，不会自动包装为 observable
 * */
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

// 拦截属性读取操作，建立依赖关系但不进行深层包装
function get(target: object, key: PropertyKey, receiver: unknown): unknown {
  // 调用 Reflect.get(target, key, receiver) 获取原始值
  const result = Reflect.get(target, key, receiver);
  if (typeof key === 'symbol' && wellKnownSymbols.has(key)) {
    return result;
  }
  // 如果当前有 reaction 在运行，建立 (target.key -> reaction) 的依赖
  registerRunningReactionForOperation({ target, key, receiver, type: 'get' });

  // 处理不可配置且不可写的属性
  const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
  if (descriptor && descriptor.writable === false && descriptor.configurable === false) {
    return result;
  }

  // 关键区别：不进行深层包装，直接返回原始值
  // 这样嵌套对象不会被转换为 observable
  return result;
}

// 作用: 拦截 in 操作符，建立依赖关系。
function has(target: object, key: PropertyKey): boolean {
  const result = Reflect.has(target, key);
  registerRunningReactionForOperation({ target, key, type: 'has' });
  return result as boolean;
}

// 拦截对象键的枚举操作，建立迭代依赖。
function ownKeys(target: object): PropertyKey[] {
  registerRunningReactionForOperation({ target, key: '', type: 'iterate' });
  return Reflect.ownKeys(target);
}

// 拦截属性设置操作，检测变化并触发 reactions。
function set(target: object, key: PropertyKey, value: unknown, receiver: unknown): boolean {
  // 解包 observable 对象，存储原始值
  if (isObject(value)) {
    value = proxyToRaw.get(value) || value;
  }
  // 判断是新增属性还是修改属性
  const hadKey = hasOwnProperty.call(target, key);
  // 用于比较值是否真的改变了
  const oldValue = (target as Record<PropertyKey, unknown>)[key];
  // 先执行赋值操作，再触发 reactions，确保 reactions 看到的是新值
  const result = Reflect.set(target, key, value, receiver);
  // 如果操作的目标不是原始接收器，则不要 queue reactions
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
 * 拦截属性删除操作，触发相关 reactions。
 * */
function deleteProperty(target: object, key: PropertyKey): boolean {
  // 记录旧状态
  const hadKey = hasOwnProperty.call(target, key);
  const oldValue = (target as Record<PropertyKey, unknown>)[key];
  // 执行删除操作
  const result = Reflect.deleteProperty(target, key);
  // 只有属性确实存在时才触发，会触发依赖该属性的 reactions
  // 也会触发依赖 ITERATION_KEY 的 reactions(键集合改变)
  if (hadKey) {
    queueReactionsForOperation({ target, key, oldValue, type: 'delete' });
  }
  return result as boolean;
}

// 拦截 new 操作符，返回响应式的实例。
// 注意：这里不使用 shadowObservable 包装，保持浅层特性
function construct(target: object, args: ArrayLike<unknown>, newTarget: unknown): object {
  let nt = newTarget;
  if (typeof newTarget === 'object' && newTarget !== null) {
    // 确保 instance instanceof Child 为 true
    if (proxyToRaw.has(newTarget)) {
      nt = proxyToRaw.get(newTarget);
    }
  }
  const result = Reflect.construct(target as Function, Array.from(args), nt as Function);
  // 不进行包装，直接返回原始结果
  return result as object;
}

export const shadowProxyHandler = { get, has, ownKeys, set, deleteProperty, construct };
