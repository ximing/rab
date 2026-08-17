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
