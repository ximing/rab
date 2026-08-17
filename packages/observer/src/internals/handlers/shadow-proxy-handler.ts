/*
 * 浅层响应式代理处理器
 * 只在根级别提供响应式能力，不会对嵌套对象进行深层转换
 * 属性的值会被原样存储和暴露，不会自动包装为 observable
 * */
import { proxyToRaw } from "../proxy-raw-map";
import {
  queueReactionsForOperation,
  registerRunningReactionForOperation,
} from "../reaction-runner";
import { iterationKeyFor } from "../reaction-track";
import { hasOwnProperty, ownDataValue, toRawIfProxy } from "../utils";
import {
  markCoveredForReceiverRoot,
  markForwardedDefineProperty,
  markNotifiedInFlightFrames,
  popForwardingFrame,
  pushForwardingFrame,
} from "./forwarding-frames";

/*
 * 存储所有内置的 Symbol(如 Symbol.iterator, Symbol.toStringTag 等)
 * 为什么需要?
 * 这些 Symbol 是 JavaScript 内部使用的
 * 不应该追踪它们的访问,否则会导致性能问题和意外行为
 * 例如: Symbol.iterator 在 for...of 循环中会被频繁访问
 * */
const wellKnownSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map((key) => Symbol[key as keyof SymbolConstructor])
    .filter((value) => typeof value === "symbol")
);

// 拦截属性读取操作，建立依赖关系但不进行深层包装
function get(target: object, key: PropertyKey, receiver: unknown): unknown {
  // 调用 Reflect.get(target, key, receiver) 获取原始值
  const result = Reflect.get(target, key, receiver);
  if (typeof key === "symbol" && wellKnownSymbols.has(key)) {
    return result;
  }
  // '__proto__' 直接返回原始原型 (原因见 base-proxy-handler 同名处理)
  if (key === "__proto__") {
    return result;
  }
  // 如果当前有 reaction 在运行，建立 (target.key -> reaction) 的依赖
  registerRunningReactionForOperation({ target, key, receiver, type: "get" });

  // 关键区别：不进行深层包装，直接返回原始值
  // 这样嵌套对象不会被转换为 observable
  // (返回值始终是 Reflect.get 的原样结果, 天然满足 Proxy 的
  //  non-writable + non-configurable 不变式, 无需 descriptor 检查)
  return result;
}

// 作用: 拦截 in 操作符，建立依赖关系。
function has(target: object, key: PropertyKey): boolean {
  const result = Reflect.has(target, key);
  registerRunningReactionForOperation({ target, key, type: "has" });
  return result as boolean;
}

// 拦截对象键的枚举操作，建立迭代依赖。
function ownKeys(target: object): PropertyKey[] {
  registerRunningReactionForOperation({ target, key: "", type: "iterate" });
  return Reflect.ownKeys(target);
}

// 拦截属性设置操作，检测变化并触发 reactions。
function set(
  target: object,
  key: PropertyKey,
  value: unknown,
  receiver: unknown
): boolean {
  // 拒绝对 '__proto__' 的赋值 (原因见 base-proxy-handler 同名处理)
  if (key === "__proto__") {
    throw new TypeError(
      "Cannot set '__proto__' on an observable object. Use Object.create() before wrapping, or set a regular property instead."
    );
  }
  // 解包 observable 对象，存储原始值
  // toRawIfProxy 守卫为 object || function（函数是一等 observable，
  // 与集合 trap / observableChild 对齐，G5 审查 issue #6）
  value = toRawIfProxy(value);
  // 判断是新增属性还是修改属性
  const hadKey = hasOwnProperty.call(target, key);
  // 用于比较值是否真的改变了。
  // 旧值捕获**不得调用自有 accessor 的 getter** (G3 不变量, 原因见
  // base-proxy-handler set trap 同名处理): accessor 属性的 oldValue 记 undefined,
  // 修改分支的变化比较退化为 Object.is(落盘值, undefined)。
  const oldValue = ownDataValue(target, key, undefined);
  // 先执行赋值操作，再触发 reactions，确保 reactions 看到的是新值
  // 转发期间记录当前 {target, key} 帧，防止 Reflect.set 路由回 defineProperty trap 造成双重通知
  const frame = pushForwardingFrame(target, key, receiver);
  let result: boolean;
  try {
    result = Reflect.set(target, key, value, receiver) as boolean;
  } finally {
    popForwardingFrame();
  }
  // Reflect.set 返回 false: 写入未生效, 状态没有变化, 不得发通知
  // (原因见 base-proxy-handler 同名处理)
  if (!result) {
    return result;
  }
  // 如果操作的目标不是原始接收器，则不要 queue reactions
  if (
    typeof receiver === "object" &&
    receiver !== null &&
    target !== proxyToRaw.get(receiver)
  ) {
    // 转发 walk 的中间层: 仅在本帧被 defineProperty trap 命中过 (frame.hit)
    // 且落盘后状态真的变化时才通知, 并把仍在栈上的同 key 外层帧标记为
    // covered (对抗审查第 3 轮 #1b, 原因见 base-proxy-handler 同名处理)。
    // frame.covered: 窗口内已有同 {target,key} 的嵌套写入通知过 (见
    // markNotifiedInFlightFrames)。落盘值与当时的已通知值一致时, 本层
    // mismatch 通知是重复的, 跳过 (G2b); 不一致时说明 covered 之后窗口内
    // 又发生了新的同 key 落盘, 按「已通知值→落盘值」补发
    // (原因见 base-proxy-handler 同名处理)。
    if (frame.hit && hasOwnProperty.call(target, key)) {
      // 落盘值读取不得调用 accessor getter (原因见 trap 入口 oldValue 注释)
      const landedValue = ownDataValue(target, key, value);
      let notified = false;
      if (frame.covered) {
        if (!Object.is(landedValue, frame.notifiedValue)) {
          if (!hadKey) {
            // key 相对窗口起点是新增: 保持 add (同时触发 ITERATION_KEY 依赖)
            queueReactionsForOperation({
              target,
              key,
              value: landedValue,
              receiver,
              type: "add",
            });
          } else {
            // observers 最后看到的是 notifiedValue, 以它为旧值按差值通知
            queueReactionsForOperation({
              target,
              key,
              value: landedValue,
              oldValue: frame.notifiedValue,
              receiver,
              type: "set",
            });
          }
          frame.notifiedValue = landedValue;
          notified = true;
        } else if (!hadKey) {
          // 落盘值与已通知值一致: {target,key} 依赖跳过; key 相对本帧窗口
          // 是新增, 仍需通知迭代依赖 (原因见 base-proxy-handler 同名处理)
          queueReactionsForOperation({
            target,
            key: iterationKeyFor(target),
            value: landedValue,
            receiver,
            type: "set",
          });
        }
      } else if (!hadKey) {
        queueReactionsForOperation({
          target,
          key,
          value: landedValue,
          receiver,
          type: "add",
        });
        notified = true;
      } else if (!Object.is(landedValue, oldValue)) {
        queueReactionsForOperation({
          target,
          key,
          value: landedValue,
          oldValue,
          receiver,
          type: "set",
        });
        notified = true;
      }
      if (notified) {
        // 只标记本转发链的根帧 (锚定 receiver), 原因见 forwarding-frames.ts
        markCoveredForReceiverRoot(receiver, key, landedValue);
      }
    }
    return result as boolean;
  }
  if (!hadKey) {
    // 新增属性: 落盘在 receiver 上 → add; 未落盘且无同 key 链上层通知过
    // (frame.covered) → 兜底 add; covered 时落盘值与已通知值一致 → 跳过,
    // 不一致 (covered 后又有新的同 key 落盘) → 按差值补发
    // (原因见 base-proxy-handler 同名处理)
    if (hasOwnProperty.call(target, key)) {
      // 落盘值读取不得调用 accessor getter (原因见 trap 入口 oldValue 注释)
      const landedValue = ownDataValue(target, key, value);
      if (frame.covered && Object.is(landedValue, frame.notifiedValue)) {
        // 已通知过该确切落盘值, {target,key} 依赖跳过; key 相对本帧窗口
        // 是新增, 仍需通知迭代依赖 (原因见 base-proxy-handler 同名处理)
        queueReactionsForOperation({
          target,
          key: iterationKeyFor(target),
          value: landedValue,
          receiver,
          type: "set",
        });
      } else {
        // 先标记后通知 (对抗审查第 2 轮 #3/#4, 原因见 base-proxy-handler
        // landed-add 分支注释): 同步 reaction 重入写回 in-flight key 时,
        // 本分支的事后 markNotified 不得把外层帧的 notifiedValue 覆写回旧值
        markNotifiedInFlightFrames(target, key, landedValue);
        queueReactionsForOperation({
          target,
          key,
          value: landedValue,
          receiver,
          type: "add",
        });
      }
    } else if (!frame.covered) {
      // 兜底 add 不做 markNotifiedInFlightFrames (原因见 base-proxy-handler 同名分支)
      queueReactionsForOperation({ target, key, value, receiver, type: "add" });
    }
  } else if (Array.isArray(target) && key === "length") {
    // 数组 length 赋值用折叠后的 target.length 与旧值比较;
    // covered 时与已通知值比较 (原因见 base-proxy-handler 同名处理)
    const newLength = target.length;
    if (frame.covered && Object.is(newLength, frame.notifiedValue)) {
      // 已通知过该确切落盘值, 跳过
    } else if (frame.covered) {
      // 先标记后通知 (原因见上方 landed-add 分支注释)
      markNotifiedInFlightFrames(target, key, newLength);
      queueReactionsForOperation({
        target,
        key,
        value: newLength,
        oldValue: frame.notifiedValue,
        receiver,
        type: "set",
      });
    } else if (!Object.is(newLength, oldValue)) {
      // 先标记后通知 (原因见上方 landed-add 分支注释)
      markNotifiedInFlightFrames(target, key, newLength);
      queueReactionsForOperation({
        target,
        key,
        value: newLength,
        oldValue,
        receiver,
        type: "set",
      });
    }
  } else {
    // 修改属性: 落盘后重读实际值参与比较;
    // covered 时与已通知值比较 (原因见 base-proxy-handler 同名分支);
    // 落盘值读取不得调用 accessor getter (原因见 trap 入口 oldValue 注释):
    // 落盘后仍是 accessor 时退化为赋入的 value 参与比较 (master 语义)
    const landedValue = ownDataValue(target, key, value);
    if (frame.covered && Object.is(landedValue, frame.notifiedValue)) {
      // 已通知过该确切落盘值, 跳过
    } else if (frame.covered) {
      // 先标记后通知 (原因见上方 landed-add 分支注释)
      markNotifiedInFlightFrames(target, key, landedValue);
      queueReactionsForOperation({
        target,
        key,
        value: landedValue,
        oldValue: frame.notifiedValue,
        receiver,
        type: "set",
      });
    } else if (!Object.is(landedValue, oldValue)) {
      // 先标记后通知 (原因见上方 landed-add 分支注释)
      markNotifiedInFlightFrames(target, key, landedValue);
      queueReactionsForOperation({
        target,
        key,
        value: landedValue,
        oldValue,
        receiver,
        type: "set",
      });
    }
  }
  return result as boolean;
}

/*
 * 拦截属性删除操作，触发相关 reactions。
 * */
function deleteProperty(target: object, key: PropertyKey): boolean {
  // 记录旧状态
  const hadKey = hasOwnProperty.call(target, key);
  // oldValue 捕获不得调用自有 accessor 的 getter (G3 不变量, 原因见
  // base-proxy-handler deleteProperty 同名处理): accessor 属性的 oldValue
  // 记 undefined
  const oldValue = ownDataValue(target, key, undefined);
  // 执行删除操作
  const result = Reflect.deleteProperty(target, key);
  // 只有删除确实生效时才触发，会触发依赖该属性的 reactions
  // 也会触发依赖 ITERATION_KEY 的 reactions(键集合改变)
  // Reflect.deleteProperty 返回 false: 删除未生效, 不得发通知
  // (与 set trap 的 !result 守卫对齐)
  if (hadKey && result) {
    queueReactionsForOperation({ target, key, oldValue, type: "delete" });
  }
  return result as boolean;
}

// 拦截 new 操作符，返回响应式的实例。
// 注意：这里不使用 shadowObservable 包装，保持浅层特性
function construct(
  target: object,
  args: ArrayLike<unknown>,
  newTarget: unknown
): object {
  let nt = newTarget;
  if (
    typeof newTarget === "object" &&
    newTarget !== null && // 确保 instance instanceof Child 为 true
    proxyToRaw.has(newTarget)
  ) {
    nt = proxyToRaw.get(newTarget);
  }
  const result = Reflect.construct(
    target as Function,
    Array.from(args),
    nt as Function
  );
  // 不进行包装，直接返回原始结果
  return result as object;
}

/*
 * 转发帧栈定义与全部帧操作都在共享模块 forwarding-frames.ts
 * (原型链可混合 base/shadow handler, 栈必须全局唯一,
 *  原因见该模块顶部注释)
 * */

/*
 * 拦截 Object.defineProperty (与 base-proxy-handler 的实现一致,
 * shadow 模式同样需要防止 defineProperty 绕过 set trap 静默失效)。
 * */
function defineProperty(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor
): boolean {
  // 来自 set trap 的 Reflect.set 转发 (且 target 与 key 都与本帧转发一致): 只透传, 通知由 set trap 负责
  // (命中帧标记 hit=true, 命中帧所在层的 set trap 落盘后重读实际值参与比较,
  //  详见 base-proxy-handler 同名处理)
  const forwarded = markForwardedDefineProperty(target, key);
  if (forwarded) {
    return Reflect.defineProperty(target, key, descriptor);
  }
  const hadKey = hasOwnProperty.call(target, key);
  const oldDescriptor = hadKey
    ? Reflect.getOwnPropertyDescriptor(target, key)
    : undefined;
  // 旧值捕获**不得调用 accessor getter** (G3 对抗审查 #2/#4, 原因见
  // base-proxy-handler 同名处理): getter 可能抛错或有副作用。
  const oldIsAccessor =
    oldDescriptor !== undefined && !("value" in oldDescriptor);
  const oldValue =
    hadKey && !oldIsAccessor
      ? (target as Record<PropertyKey, unknown>)[key]
      : undefined;
  const result = Reflect.defineProperty(target, key, descriptor);
  if (!result) {
    return false;
  }
  if (!hadKey) {
    queueReactionsForOperation({
      target,
      key,
      value: descriptor.value,
      type: "add",
    });
  } else if (Array.isArray(target) && key === "length") {
    // 与 set trap 一致: 数组 length 用折叠后的 target.length 与旧值比较
    const newLength = target.length;
    if (!Object.is(newLength, oldValue)) {
      queueReactionsForOperation({
        target,
        key,
        value: newLength,
        oldValue,
        type: "set",
      });
    }
  } else if ("value" in descriptor) {
    // 数据描述符: Object.is 判值变化; 旧属性是 accessor 时种类翻转必通知
    // (原因见 base-proxy-handler 同名处理)
    if (oldIsAccessor || !Object.is(descriptor.value, oldValue)) {
      queueReactionsForOperation({
        target,
        key,
        value: descriptor.value,
        oldValue,
        type: "set",
      });
    }
  } else if ("get" in descriptor || "set" in descriptor) {
    // accessor 描述符: 种类翻转或 get/set 身份变化必通知。
    // 身份比较前按旧描述符补全部分描述符 (spec: 省略的分量保持旧值),
    // 通知不携带新值、不调用新 getter
    // (原因见 base-proxy-handler 同名处理)
    const oldWasData =
      oldDescriptor === undefined || "value" in oldDescriptor;
    const accessorChanged =
      !oldWasData &&
      (!Object.is(
        "get" in descriptor ? descriptor.get : oldDescriptor!.get,
        oldDescriptor!.get
      ) ||
        !Object.is(
          "set" in descriptor ? descriptor.set : oldDescriptor!.set,
          oldDescriptor!.set
        ));
    if (oldWasData || accessorChanged) {
      queueReactionsForOperation({
        target,
        key,
        value: undefined,
        oldValue,
        type: "set",
      });
    }
  }
  // 枚举语义翻转必须通知迭代依赖; writable/configurable 翻转不通知
  // (原因见 base-proxy-handler 同名处理)
  if (
    hadKey &&
    oldDescriptor!.enumerable !==
      (descriptor.enumerable ?? oldDescriptor!.enumerable)
  ) {
    queueReactionsForOperation({
      target,
      key: iterationKeyFor(target),
      type: "set",
    });
  }
  return result;
}

export const shadowProxyHandler = {
  get,
  has,
  ownKeys,
  set,
  deleteProperty,
  defineProperty,
  construct,
};
