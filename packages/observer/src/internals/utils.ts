import { proxyToRaw } from "./proxy-raw-map";

export const hasOwnProperty = Object.prototype.hasOwnProperty;
// Type guard to check if value is an object
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

export function isObservable(obj: unknown): boolean {
  return !!obj && proxyToRaw.has(obj);
}

export function raw<T extends object>(obj: T): T {
  return (proxyToRaw.get(obj) as T) || obj;
}

/*
 * 集合方法入参解包 (key / value 通用)。
 *
 * collectionHandlers / shadowCollectionHandlers 的 set/add/get/has/delete
 * 拿到的参数可能是 observable proxy (例如 map.set(state.box, 1) 里 state.box
 * 是深层包装后的对象)。集合内部按对象身份存取, 且依赖注册 (wrapKey) 按 key
 * 对象身份缓存 WeakRef —— proxy 与 raw 是两个不同身份:
 *   - 存 proxy 取 raw: Map/Set 查找直接失灵;
 *   - 注册用一种身份、通知用另一种: 依赖落在不同 WeakRef 上, 永久漏通知。
 * 因此入口处统一解包: 是对象或函数且是 observable proxy 时替换为 raw。
 * 函数守卫与 observableChild 对齐 —— 函数在本系统中是一等 observable
 * (observable(fn) 返回 function proxy, shouldInstrument 显式支持函数),
 * 若沿用 typeof === "object" 守卫, 函数 key/value 的 proxy/raw 身份分裂
 * 依然存在 (存 proxy 取 raw 失灵、依赖注册与通知落在不同身份上永久漏通知)。
 */
export function toRawIfProxy<T>(value: T): T {
  if (isObject(value) || typeof value === "function") {
    const rawValue = proxyToRaw.get(value);
    if (rawValue !== undefined) {
      return rawValue as T;
    }
  }
  return value;
}

/*
 * Map/Set 被包装为 observable 时（deep/shadow 两个创建路径）把既有条目中的
 * observable proxy key/value 归一化为 raw，确立不变量：
 * 『集合内部只持有 raw 身份』。
 *
 * 为什么必须在这里做（G5 第 3 轮审查 issue #1）：trap 入口已统一
 * toRawIfProxy 解包，若集合在包装**之前**已有 proxy 条目（典型:
 * observable(new Map([[box, 42]]))，box 是 observable proxy；或经
 * raw(m).set 绕过 trap 写入），raw target 内持有的仍是 proxy ——
 * get/has/delete 全部静默失灵，且与 trap 写入混合会产生同一逻辑 key
 * 的两个条目，残留的 proxy 条目经 trap 永远不可达。
 *
 * 迭代中改写 Map/Set 是安全的：改 value 不会重访已访问的 key；
 * 换 key（delete proxy + set raw）新增的 raw key 会被再次访问到，
 * 但那时 toRawIfProxy 已是恒等，不会再改写 —— 无死循环。
 *
 * 判"确实发生了替换"必须用 Object.is 而不是 !==：Map/Set 以
 * SameValueZero 合法支持 NaN key，而 NaN !== NaN 恒为 true，
 * 用 !== 判重会把 NaN 条目删掉再追加到尾部，迭代器重访该条目
 * → 无限死循环 (GG7 对抗审查第 2 轮 issue #1)。toRawIfProxy 对
 * 原始值恒等返回，Object.is 只在真的 proxy→raw 替换时为 false。
 *
 * 限制：WeakMap/WeakSet 不可枚举，无法在此归一化 —— 构造期存入的
 * proxy key 依旧不可达（Vue 3 的集合 instrumentation 存在同样边缘），
 * 由 collection-unwrap-prepopulated-normalization.test.ts 的 pin 测试
 * 明确该边界。一次性 O(n) 成本，仅在首次包装时发生。
 */
export function normalizeCollectionEntries(target: object): void {
  if (target instanceof Map) {
    for (const [key, value] of target) {
      const rawKey = toRawIfProxy(key);
      const rawValue = toRawIfProxy(value);
      if (!Object.is(rawKey, key)) {
        target.delete(key);
        target.set(rawKey, rawValue);
      } else if (!Object.is(rawValue, value)) {
        target.set(key, rawValue);
      }
    }
    return;
  }
  if (target instanceof Set) {
    for (const value of target) {
      const rawValue = toRawIfProxy(value);
      if (!Object.is(rawValue, value)) {
        target.delete(value);
        target.add(rawValue);
      }
    }
  }
}

/*
 * 读取自有属性的**数据**值, 不触发 accessor getter。
 *
 * G3 不变量 (defineProperty trap 于 538b29e 确立, set/deleteProperty trap 对齐):
 * trap 不得调用自有 accessor 的 getter ——
 *   - 抛错型 getter 会让赋值/删除/重定义向调用方抛错且写入丢失
 *     (原生语义下这些操作从不调用 getter);
 *   - 副作用型 getter 会以 this=raw 被调用, 其对 raw 的变更绕过所有 trap,
 *     窗口内外丢通知。
 *
 * 属性不存在或是 accessor 时返回 fallback (典型 fallback: undefined 当旧值,
 * 或赋入的 value 当落盘比较值 —— setter 忽略写入时本来就无从无副作用地
 * 获知落盘值)。
 */
export function ownDataValue(
  target: object,
  key: PropertyKey,
  fallback: unknown
): unknown {
  const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
  if (descriptor !== undefined && "value" in descriptor) {
    return descriptor.value;
  }
  return fallback;
}
