/**
 * 路径解析工具
 *
 * 实现与 dot-prop 兼容的点分路径读取能力。
 * 核心设计原则：「操作在浏览器内，传出去的只有断言结果」
 *
 * 路径语法规范（dot-prop 兼容）：
 * - "field"            顶层直接属性
 * - "a.b.c"            嵌套属性（点分）
 * - "arr.0"            数组下标（.数字 形式，不支持 [0] 方括号）
 * - "arr.0.field"      下标 + 属性
 *
 * @example
 *   resolvePath(instance, "ladingMonitorData.list.0.status")
 *   resolvePath(instance, "selectedTemperature.length")
 */

/**
 * 解析点分路径字符串为 key 数组
 * 处理 dot-prop 兼容的转义点（\\.）语法
 *
 * @example
 *   parsePath("a.b.c")        → ["a", "b", "c"]
 *   parsePath("arr.0.status") → ["arr", "0", "status"]
 *   parsePath("a\\.b.c")      → ["a.b", "c"]（含转义点的 key）
 */
function parsePath(path: string): string[] {
  const segments: string[] = [];
  let current = '';
  let i = 0;

  while (i < path.length) {
    const char = path[i];
    // 转义点：\. 表示 key 中的字面量点
    if (char === '\\' && i + 1 < path.length && path[i + 1] === '.') {
      current += '.';
      i += 2;
    } else if (char === '.') {
      if (current.length > 0) {
        segments.push(current);
      }
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

/**
 * 从对象按点分路径读取末端值
 *
 * 安全语义：
 * - 中间节点为 null/undefined 时，返回 undefined，不抛错
 * - 路径不存在时，返回 undefined
 * - 只做属性访问，不调用任何函数
 * - 不做任何序列化，直接返回末端原始值
 *
 * @param instance 目标对象（通常为 Service 实例）
 * @param path 点分路径字符串
 * @returns 末端值（未找到时返回 undefined）
 */
export function resolvePath(instance: object, path: string): unknown {
  if (!path) return undefined;

  const segments = parsePath(path);
  let current: unknown = instance;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object' && typeof current !== 'function') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * 将原始值转为"安全摘要"，用于在 AssertionResult.actual 中传输给 Agent
 *
 * 规则：
 * - string / number / boolean / null / undefined → 原值
 * - Array → "[Array(N)]"（N 为数组长度）
 * - object（非 null） → "[Object]"
 * - function → "[Function]"
 */
export function toSafeActual(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'function') return '[Function]';
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  if (typeof value === 'object') return '[Object]';
  return String(value);
}
