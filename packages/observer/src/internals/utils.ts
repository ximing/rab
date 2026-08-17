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
 * 因此入口处统一解包: 是对象且是 observable proxy 时替换为 raw 对象。
 */
export function toRawIfProxy<T>(value: T): T {
  if (isObject(value)) {
    const rawValue = proxyToRaw.get(value);
    if (rawValue !== undefined) {
      return rawValue as T;
    }
  }
  return value;
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
