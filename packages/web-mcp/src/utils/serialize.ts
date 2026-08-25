/**
 * 状态序列化工具
 *
 * 将 Service 实例的属性提取为可序列化的快照，处理以下特殊情况：
 * - 函数属性：过滤，不作为状态输出
 * - 私有属性（_ 或 $ 开头，除 $model）：过滤
 * - 循环引用：安全 JSON 序列化处理
 * - Observable Proxy：直接读取属性值，不触发依赖追踪
 */

import type { Service } from '@rabjs/service';

/**
 * 检查属性名是否为需要过滤的私有属性
 * 规则：以 _ 或 $ 开头的属性，除 $model 外
 */
function isPrivateKey(key: string): boolean {
  if (key === '$model') return false;
  return key.startsWith('_') || key.startsWith('$');
}

/**
 * 提取 Service 实例的状态属性列表（键名）
 * 过滤函数属性、私有属性
 */
export function getStateKeys(instance: Service): string[] {
  const keys: string[] = [];

  // 遍历实例自身属性
  for (const key of Object.keys(instance)) {
    if (key === 'instanceId') continue; // instanceId 是路由字段，不作为状态
    if (isPrivateKey(key)) continue;

    const value = (instance as any)[key];
    if (typeof value === 'function') continue;

    keys.push(key);
  }

  return keys;
}

/**
 * 安全 JSON 序列化，处理循环引用
 */
function safeSerialize(value: unknown): unknown {
  const seen = new WeakSet();

  function serialize(val: unknown): unknown {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object' && typeof val !== 'function') return val;
    if (typeof val === 'function') return undefined;

    if (seen.has(val as object)) {
      return '[Circular]';
    }

    seen.add(val as object);

    if (Array.isArray(val)) {
      const result = val.map(item => serialize(item));
      seen.delete(val as object);
      return result;
    }

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(val as object)) {
      const serialized = serialize((val as any)[key]);
      if (serialized !== undefined) {
        result[key] = serialized;
      }
    }
    seen.delete(val as object);
    return result;
  }

  return serialize(value);
}

/**
 * 将值转为降级后 get_state 使用的安全摘要
 * - 基本类型（string/number/boolean/null/undefined）：原值
 * - Array：返回 "[Array(N)]"
 * - object（非 null）：返回 "[Object]"
 * - function：返回 undefined（过滤）
 */
function toStateSummary(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'function') return undefined;
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  if (typeof value === 'object') return '[Object]';
  return String(value);
}

/**
 * 提取 Service 实例的状态快照（降级版本，只返回标量字段和对象摘要）
 *
 * 规避大对象序列化 crash 的安全版本：
 * - 标量字段（string/number/boolean/null）：直接返回原值
 * - 复杂对象字段：只返回类型摘要（"[Object]" 或 "[Array(N)]"）
 *
 * 对于需要深入验证对象内部的场景，使用 assert_state + 点分路径代替。
 *
 * @param instance Service 实例
 * @param keys 可选，指定要读取的属性名，不传则返回全部
 * @returns 安全状态快照（可 JSON 序列化）
 */
export function serializeStateSafe(instance: Service, keys?: string[]): Record<string, unknown> {
  const allKeys = keys ?? getStateKeys(instance);
  const result: Record<string, unknown> = {};

  for (const key of allKeys) {
    if (isPrivateKey(key)) continue;

    const value = (instance as any)[key];
    if (typeof value === 'function') continue;

    const summary = toStateSummary(value);
    if (summary !== undefined) {
      result[key] = summary;
    }
  }

  return result;
}

/**
 * 提取 Service 实例的状态快照
 *
 * @param instance Service 实例
 * @param keys 可选，指定要读取的属性名，不传则返回全部
 * @returns 状态快照（可 JSON 序列化）
 */
export function serializeState(instance: Service, keys?: string[]): Record<string, unknown> {
  const allKeys = keys ?? getStateKeys(instance);
  const result: Record<string, unknown> = {};

  for (const key of allKeys) {
    if (isPrivateKey(key)) continue;

    const value = (instance as any)[key];
    if (typeof value === 'function') continue;

    result[key] = safeSerialize(value);
  }

  return result;
}

/**
 * 提取 Service 实例的 $model 状态（loading/error）
 *
 * @param instance Service 实例
 * @returns model 状态快照
 */
export function serializeModel(
  instance: Service
): Record<string, { loading: boolean; error: string | null }> {
  const model = (instance as any).$model;
  if (!model || typeof model !== 'object') return {};

  const result: Record<string, { loading: boolean; error: string | null }> = {};

  for (const key of Object.keys(model)) {
    const state = model[key];
    if (state && typeof state === 'object') {
      result[key] = {
        loading: Boolean(state.loading),
        error: state.error ? String(state.error.message || state.error) : null,
      };
    }
  }

  return result;
}
