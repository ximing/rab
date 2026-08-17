/*
 * 定义了用于普通对象和数组的 Proxy handlers,实现:
 * 1. 读取拦截: 追踪属性访问,建立依赖关系
 * 2. 写入拦截: 检测属性变化,触发相关 reactions
 * 3. 深度响应式: 自动包装嵌套对象为 observable
 * 4. 边界处理: 处理特殊情况(Symbol、不可配置属性、原型链等)
 * */
import { observable } from "../observable";
import { observableChild } from "../observable-child";
import { proxyToRaw } from "../proxy-raw-map";
import {
  markCoveredForReceiverRoot,
  markForwardedDefineProperty,
  markNotifiedInFlightFrames,
  popForwardingFrame,
  pushForwardingFrame,
} from "./forwarding-frames";
import {
  queueReactionsForOperation,
  registerRunningReactionForOperation,
} from "../reaction-runner";
import { iterationKeyFor } from "../reaction-track";
import { hasOwnProperty, isObject } from "../utils";

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

/*
 * 原型链上的敏感属性: 读取时不做依赖注册/包装, 写入时直接拒绝。
 * 背景: get trap 读 '__proto__' 会返回 Object.prototype (或 Array.prototype),
 * 若被 observableChild 包装, 对它的写入就会进入响应式系统并落在全局原型上,
 * 构成原型污染路径; 'constructor'/'prototype' 同理不应被包装成 observable。
 * 注意: 若这些名字是用户自定义的"自有属性"(own property), 不受此限制。
 * */
const PROTOTYPE_SENSITIVE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// 拦截属性读取操作,建立依赖关系并返回响应式的值。
function get(target: object, key: PropertyKey, receiver: unknown): unknown {
  // 调用 Reflect.get(target, key, receiver) 获取原始值
  const result = Reflect.get(target, key, receiver);
  if (typeof key === "symbol" && wellKnownSymbols.has(key)) {
    return result;
  }
  // '__proto__' 直接返回原始原型: 不注册依赖 (不可能有对应通知), 也不包装
  if (key === "__proto__") {
    return result;
  }
  // 如果当前有 reaction 在运行,建立 (target.key -> reaction) 的依赖
  registerRunningReactionForOperation({ target, key, receiver, type: "get" });

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
  // Proxy 不变式只对"会被改写的返回值"有意义: 只有对象/函数会经
  // observableChild 包装 (原始值原样返回, 不可能违反不变式)。
  // 因此原始值直接返回, 跳过 getOwnPropertyDescriptor 的热路径开销。
  if (!isObject(result) && typeof result !== "function") {
    return result;
  }

  const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
  if (
    descriptor &&
    descriptor.writable === false &&
    descriptor.configurable === false
  ) {
    return result;
  }
  // 'constructor'/'prototype' 来自原型链(非自有属性)时保持原生语义, 不包装
  // (否则 state.constructor 会拿到 Object 构造函数的 observable 包装)
  if (!descriptor && PROTOTYPE_SENSITIVE_KEYS.has(key as string)) {
    return result;
  }

  // 如果返回值是对象,自动包装为 observable 实现深度响应式
  return observableChild(result, target);
}

// 作用: 拦截 in 操作符,建立依赖关系。
function has(target: object, key: PropertyKey): boolean {
  const result = Reflect.has(target, key);
  registerRunningReactionForOperation({ target, key, type: "has" });
  return result as boolean;
}

// 拦截对象键的枚举操作,建立迭代依赖。
function ownKeys(target: object): PropertyKey[] {
  registerRunningReactionForOperation({ target, key: "", type: "iterate" });
  return Reflect.ownKeys(target);
}

// 截属性设置操作,检测变化并触发 reactions。
function set(
  target: object,
  key: PropertyKey,
  value: unknown,
  receiver: unknown
): boolean {
  // 拒绝对 '__proto__' 的赋值:
  // 不拦截时, Reflect.set 会调用 Object.prototype 的 __proto__ setter,
  // 静默改掉 raw 对象的原型且不触发任何 reaction;
  // 更危险的是 JSON 注入 + 深合并场景 (JSON.parse 把 "__proto__" 解析为自有属性,
  // Object.assign 之类通过 [[Set]] 传播), 会把用户可控数据的原型替换为攻击者对象。
  // 这里选择 fail-fast 抛错而不是静默忽略, 让问题在开发期暴露。
  if (key === "__proto__") {
    throw new TypeError(
      "Cannot set '__proto__' on an observable object. Use Object.create() before wrapping, or set a regular property instead."
    );
  }
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
  // 转发期间记录当前 {target, key} 帧, 防止 Reflect.set 路由回 defineProperty trap 造成双重通知
  const frame = pushForwardingFrame(target, key, receiver);
  let result: boolean;
  try {
    result = Reflect.set(target, key, value, receiver) as boolean;
  } finally {
    popForwardingFrame();
  }
  // Reflect.set 返回 false: 写入未生效 (sealed/frozen target、不可写属性、
  // strict setter 返回 false 等), 状态没有变化, 不得发通知 ——
  // 否则 sealed 数组上失败的 length 收缩会假通知 length 依赖。
  if (!result) {
    return result;
  }
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
  if (
    typeof receiver === "object" &&
    receiver !== null &&
    target !== proxyToRaw.get(receiver)
  ) {
    // 转发 walk 的中间层: 通知责任默认归最外层 receiver 的 set trap。
    // 例外 (对抗审查第 3 轮 #1b): 原型链 setter 对本层 observable 的同 key
    // defineProperty 会命中本层转发帧被透传 (防双通知所必需), 本层 set trap
    // 又因 receiver 不匹配走到这里 —— 若不通知, 本层 reaction 丢通知。
    // 仅在本帧确实被 defineProperty trap 命中过 (frame.hit, 排除"setter 只改
    // 外部变量/写 raw 对象"等本层 raw 实际未被动过的场景) 且落盘后状态真的
    // 变化时才通知; 仅读自有属性, 不沿原型链 (避免 raw 读触发外层 proxy
    // get trap 的副作用)。通知后把仍在栈上的同 key 外层帧标记为 covered,
    // 最外层 receiver 的兜底 add 据此跳过, 防止链上 reaction 双通知。
    // frame.covered: 窗口内已有同 {target,key} 的嵌套写入通知过 (见
    // markNotifiedInFlightFrames)。落盘值与当时的已通知值一致时, 本层
    // mismatch 通知是重复的, 跳过 (G2b); 不一致时说明 covered 之后窗口内
    // 又发生了新的同 key 落盘 (如 setter 在嵌套赋值之后再显式
    // defineProperty 改值 / 重定义 accessor), 必须按「已通知值→落盘值」
    // 补发, 否则 reaction 永久停留在中间值 (对抗审查第 4 轮 #1/#3)。
    if (frame.hit && hasOwnProperty.call(target, key)) {
      const landedValue = (target as Record<PropertyKey, unknown>)[key];
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
            // observers 最后看到的是 notifiedValue (帧入口的 oldValue 已过期),
            // 以它为旧值按差值通知
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
          // 落盘值与已通知值一致: {target,key} 依赖已随嵌套通知触发, 跳过;
          // 但 key 相对本帧窗口是新增, 键集合变化仍需通知迭代依赖
          // (ownKeys / 数组 length 桶), 否则 Object.keys 观察者漏掉新键
          queueReactionsForOperation({
            target,
            key: iterationKeyFor(target),
            value: landedValue,
            receiver,
            type: "set",
          });
        }
      } else if (!hadKey) {
        // 窗口内本层新增了该 key
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
        // 只标记本转发链的根帧 (锚定 receiver), 不按 key 名匹配所有外层帧 ——
        // setter 内无关链的同名嵌套写入会误标外层链, 吞掉外层的兜底 add
        markCoveredForReceiverRoot(receiver, key, landedValue);
      }
    }
    return result as boolean;
  }
  if (!hadKey) {
    // 新增属性，会触发依赖 ITERATION_KEY 的 reactions(因为键集合改变了)。
    // - key 落盘在 receiver 的 raw 上 (引擎路由回 receiver 的普通原型链赋值,
    //   场景B): 发 add;
    // - 没落盘但也没有同 key 的链上层通知过 (frame.covered, 如 setter 把值
    //   写到了别处): 仍按既有语义发兜底 add, 通知依赖 receiver key 的 reactions;
    // - 链上某层已按落盘状态通知过 (covered): 落盘值与已通知值一致时跳过
    //   (防止同时依赖链上多层 key 的 reaction 收到两次通知); 不一致时说明
    //   covered 之后窗口内又有新的同 key 落盘, 按「已通知值→落盘值」补发
    //   (对抗审查第 4 轮 #2: 写入起点在被改层自身时, 根帧 landed 分支同样
    //   受 covered 约束, 不再对已通知过的同一落盘值重复发 add)。
    if (hasOwnProperty.call(target, key)) {
      const landedValue = (target as Record<PropertyKey, unknown>)[key];
      if (frame.covered && Object.is(landedValue, frame.notifiedValue)) {
        // 已通知过该确切落盘值, {target,key} 依赖跳过; 但 key 相对本帧窗口
        // 是新增, 键集合变化仍需通知迭代依赖 (原因见 mismatch 分支注释)
        queueReactionsForOperation({
          target,
          key: iterationKeyFor(target),
          value: landedValue,
          receiver,
          type: "set",
        });
      } else {
        // key 相对窗口起点是新增, 保持 add (含 ITERATION_KEY 依赖),
        // 携带落盘后的实际值
        queueReactionsForOperation({
          target,
          key,
          value: landedValue,
          receiver,
          type: "add",
        });
        markNotifiedInFlightFrames(target, key, landedValue);
      }
    } else if (!frame.covered) {
      // 兜底 add (本链没有落盘, 写到了别处): 不做 markNotifiedInFlightFrames ——
      // 它不代表本 raw 上的落盘状态变化, 嵌套写入的兜底通知不得抑制外层另一次
      // 写入的兜底通知 (转发窗口内 reaction 重入写回 in-flight key 的场景,
      // 两次写入都必须被观察到)。
      queueReactionsForOperation({ target, key, value, receiver, type: "add" });
    }
  } else if (Array.isArray(target) && key === "length") {
    // 数组 length 赋值: 引擎按 ArraySetLength 规则把 value 折叠成
    // canonical number 后生效, 原始 value 可能是字符串 ('5') 或非整数,
    // 不能与 trap 捕获的旧 length 直接比较 ('5' !== 5 → 同值假通知)。
    // 用赋值后的 target.length (折叠后的新长度) 比较, 并把 canonical
    // 新长度作为通知的 value (下游收缩窗口计算依赖数值化的新长度)。
    // covered 时与已通知值比较 (原因见上方 landed-add 分支注释)。
    const newLength = target.length;
    if (frame.covered && Object.is(newLength, frame.notifiedValue)) {
      // 已通知过该确切落盘值, 跳过
    } else if (frame.covered) {
      queueReactionsForOperation({
        target,
        key,
        value: newLength,
        oldValue: frame.notifiedValue,
        receiver,
        type: "set",
      });
      markNotifiedInFlightFrames(target, key, newLength);
    } else if (!Object.is(newLength, oldValue)) {
      queueReactionsForOperation({
        target,
        key,
        value: newLength,
        oldValue,
        receiver,
        type: "set",
      });
      markNotifiedInFlightFrames(target, key, newLength);
    }
  } else {
    // 修改属性: 落盘后重读 target[key] 实际值参与比较。
    // - 自有 accessor 的 setter 内可能对同一 key defineProperty 落盘
    //   变换后的值 (defineProperty trap 命中转发帧只透传不通知),
    //   "赋值值 vs 旧值"比较会误判无变化而丢通知, 通知 value 也应携带
    //   实际落盘值 (debuggerReaction 会消费到);
    // - 引擎路由回 receiver 的普通赋值 landed === value, 行为不变;
    // - 变换型 setter 写回值恰使观察值不变时, 不再发假通知;
    // - covered 时与已通知值比较 (原因见上方 landed-add 分支注释)。
    const landedValue = (target as Record<PropertyKey, unknown>)[key];
    if (frame.covered && Object.is(landedValue, frame.notifiedValue)) {
      // 已通知过该确切落盘值, 跳过
    } else if (frame.covered) {
      queueReactionsForOperation({
        target,
        key,
        value: landedValue,
        oldValue: frame.notifiedValue,
        receiver,
        type: "set",
      });
      markNotifiedInFlightFrames(target, key, landedValue);
    } else if (!Object.is(landedValue, oldValue)) {
      queueReactionsForOperation({
        target,
        key,
        value: landedValue,
        oldValue,
        receiver,
        type: "set",
      });
      markNotifiedInFlightFrames(target, key, landedValue);
    }
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
  // 只有删除确实生效时才触发,会触发依赖该属性的 reactions
  // 也会触发依赖 ITERATION_KEY 的 reactions(键集合改变)
  // Reflect.deleteProperty 返回 false (frozen 等不可配置属性): 删除未生效,
  // 状态没有变化, 不得发通知 (与 set trap 的 !result 守卫对齐)
  if (hadKey && result) {
    queueReactionsForOperation({ target, key, oldValue, type: "delete" });
  }
  return result as boolean;
}

// 拦截 new 操作符,返回响应式的实例。
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
  if (typeof result === "object" && result !== null) {
    return observable(result) as object;
  }
  return result as object;
}

/*
 * 记录 set trap 正在做 Reflect.set 转发的 target 栈。
 * 背景: set trap 调用 Reflect.set(target, key, value, receiver) 且 receiver 是 proxy 时,
 * 规范 (OrdinarySetWithOwnDescriptor) 会把写入路由回 Receiver.[[DefineOwnProperty]],
 * 即普通赋值也会触发 defineProperty trap。此时通知由 set trap 统一负责,
 * defineProperty trap 不应重复通知, 否则每次赋值触发两次 reactions。
 *
 * 为什么是 {target, key} 帧的栈而不是布尔/单个 target/裸 target 栈:
 * - 布尔: 转发期间若原型链 setter 内部对"另一个" observable 调 Object.defineProperty,
 *   会被误判为转发而跳过通知 (跨 target 误伤);
 * - 单个 target: 原型链转发的嵌套 set trap 会用内层 target 覆盖外层记录,
 *   导致最外层 receiver 上的定义回不再匹配 (双通知回归);
 * - 裸 target 栈: 转发窗口内对"栈中 target"的**另一个 key** 调 Object.defineProperty
 *   仍会被吞掉通知 (值已变、reaction 未收到);
 * Reflect.set 路由回 Receiver.[[DefineOwnProperty]] 时携带的必然是正在写的同一个 key
 * (OrdinarySetWithOwnDescriptor 语义), 因此帧按 {target, key} 精确匹配即可
 * 在保留防双通知行为的同时, 让 setter 内对同 target 异 key 的 defineProperty 正常通知。
 * */
/*
 * 转发帧栈定义与全部帧操作都在共享模块 forwarding-frames.ts:
 * 原型链可混合 base/shadow 两种 handler, 各持独立栈会让跨 handler 的
 * covered 抑制失效 (链上 reaction 双通知), 栈必须全局唯一。
 * */


/*
 * 拦截 Object.defineProperty, 防止其绕过 set trap 静默修改属性。
 * 没有 this trap 时, defineProperty 默认转发直接写 raw target,
 * 通知逻辑被完全绕过, 已注册的 reaction 看不到变化。
 * */
function defineProperty(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor
): boolean {
  // 来自 set trap 的 Reflect.set 转发 (且 target 与 key 都与本帧转发一致): 只透传, 通知由 set trap 负责
  //
  // 转发窗口内用户对**同一 {target,key}** 的 Object.defineProperty 与引擎路由回的
  // [[DefineOwnProperty]] 在 trap 边界不可区分, 同样会被透传。这不再丢通知:
  // 命中的帧标记 hit=true, 命中帧所在层的 set trap 落盘后重读 target[key]
  // 实际值参与变化比较 (见 set trap 注释), setter 同 key defineProperty
  // 变换落盘值时由 set trap 统一通知。
  // 详见 src/__tests__/forwarding-window-documented-limitations.test.ts。
  const forwarded = markForwardedDefineProperty(target, key);
  if (forwarded) {
    return Reflect.defineProperty(target, key, descriptor);
  }
  const hadKey = hasOwnProperty.call(target, key);
  // 已知限制 (归 G3/G7): 这里以 this=raw 读取旧值会触发 accessor getter,
  // 副作用型 getter 内对 this (raw) 的 Object.defineProperty 直接改 raw、
  // 完全绕过 proxy trap, 窗口内外都丢通知。待 G3/G7 改为仅对 data
  // descriptor 读旧值 / accessor 标记 unknown 强制通知。
  // 详见 src/__tests__/forwarding-window-documented-limitations.test.ts。
  const oldValue = hadKey
    ? (target as Record<PropertyKey, unknown>)[key]
    : undefined;
  const oldDescriptor = hadKey
    ? Reflect.getOwnPropertyDescriptor(target, key)
    : undefined;
  const result = Reflect.defineProperty(target, key, descriptor);
  if (!result) {
    return false;
  }
  // 与 set trap 保持一致的判定: 新增属性 → add, 值变化 → set
  if (!hadKey) {
    queueReactionsForOperation({
      target,
      key,
      value: descriptor.value,
      type: "add",
    });
  } else if (Array.isArray(target) && key === "length") {
    // 与 set trap 一致: 数组 length 的 descriptor.value 可能是字符串 ('5'),
    // 直接与旧值比较会同值假通知, 用折叠后的 target.length 比较。
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
    // 数据描述符: 用 Object.is 判值变化 (NaN 连写不误通知, ±0 区分)。
    // 旧属性是 accessor 时, 即使值 "相同" 也发生了 属性种类 翻转,
    // 读取语义已改变, 不得静默跳过。
    const oldIsAccessor =
      oldDescriptor !== undefined && !("value" in oldDescriptor);
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
    // accessor 描述符: 旧属性是数据属性 (种类翻转), 或 get/set 函数身份
    // 变化时, 读取语义已改变, 必须以 "set" 通知; 重新定义相同的
    // getter/setter 不通知。setter-only 描述符读取会抛错, 此时 value
    // 传 undefined, 不调用 getter。
    const oldWasData =
      oldDescriptor === undefined || "value" in oldDescriptor;
    const accessorChanged =
      !oldWasData &&
      (!Object.is(descriptor.get, oldDescriptor!.get) ||
        !Object.is(descriptor.set, oldDescriptor!.set));
    if (oldWasData || accessorChanged) {
      const newValue =
        descriptor.get === undefined
          ? undefined
          : (target as Record<PropertyKey, unknown>)[key];
      queueReactionsForOperation({
        target,
        key,
        value: newValue,
        oldValue,
        type: "set",
      });
    }
  }
  return result;
}

export const baseProxyHandler = {
  get,
  has,
  ownKeys,
  set,
  deleteProperty,
  defineProperty,
  construct,
};
