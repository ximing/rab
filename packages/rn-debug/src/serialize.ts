const MAX_DEPTH = 6;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

function serialize(value: unknown, depth: number, seen: Set<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' || typeof value === 'symbol' || value === undefined
      ? undefined
      : value;
  }
  if (seen.has(value as object)) return '[Circular]';
  if (depth >= MAX_DEPTH) return '[Truncated]';
  seen.add(value as object);
  try {
    if (Array.isArray(value)) {
      return value.map(item => serialize(item, depth + 1, seen));
    }
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        const serialized = serialize(value[key], depth + 1, seen);
        if (serialized !== undefined) out[key] = serialized;
      }
      return out;
    }
    // Map / Set / 类实例等：退化为字符串标记
    return `[${Object.prototype.toString.call(value).slice(8, -1)}]`;
  } finally {
    seen.delete(value as object);
  }
}

export function safeSerialize(
  value: unknown
): { ok: true; data: unknown } | { ok: false; error: { message: string } } {
  try {
    const data = serialize(value, 0, new Set());
    // 终检：确保 JSON 可序列化
    JSON.stringify(data);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: { message: `result not serializable: ${String(err)}` } };
  }
}
