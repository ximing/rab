import type { Service } from '@rabjs/service';

function isPrivateKey(key: string): boolean {
  if (key === '$model') return false;
  return key.startsWith('_') || key.startsWith('$');
}

export function getStateKeys(instance: Service): string[] {
  const keys: string[] = [];

  for (const key of Object.keys(instance)) {
    if (key === 'instanceId') continue;
    if (isPrivateKey(key)) continue;

    const value = (instance as any)[key];
    if (typeof value === 'function') continue;

    keys.push(key);
  }

  return keys;
}

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

export function serializeState(
  instance: Service,
  keys?: string[]
): Record<string, unknown> {
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
