import { getGlobalContainer } from '@rabjs/service';
import type { Container, Service } from '@rabjs/service';
import { executeAssertions, resolvePath } from '@rabjs/shared';
import type { Assertion } from '@rabjs/shared';

import { safeSerialize } from './serialize';
import type { DebugHandler } from './types';

interface ServiceRef {
  instanceId: string;
  containerName: string;
  identifierLabel: string;
  instance: Service;
}

/**
 * 从 ServiceIdentifier 生成展示标签（与 @rabjs/service 的 instanceId 前缀规则一致）
 * - Constructor → 类名字符串，如 "CartService"
 * - string    → 原样返回，如 "cartService"
 * - symbol    → "Symbol(description)"
 */
function identifierLabelOf(identifier: unknown): string {
  if (typeof identifier === 'function') return identifier.name || 'AnonymousService';
  if (typeof identifier === 'string') return identifier;
  if (typeof identifier === 'symbol') {
    return `Symbol(${identifier.description ?? ''})`;
  }
  return 'Anonymous';
}

function walkCollect(container: Container, containerName: string, out: ServiceRef[]) {
  for (const definition of container.getServiceDefinitions()) {
    const instance = (definition as { instance?: Service }).instance;
    if (!instance) continue;
    const svc = instance as Service & { instanceId?: string };
    out.push({
      instanceId: svc.instanceId ?? '',
      containerName,
      identifierLabel:
        identifierLabelOf((definition as { identifier?: unknown }).identifier) ||
        svc.constructor?.name ||
        'Anonymous',
      instance,
    });
  }
  for (const child of container.getChildren()) {
    walkCollect(child, String(child.getName()), out);
  }
}

function listServices(): ServiceRef[] {
  const root = getGlobalContainer();
  const out: ServiceRef[] = [];
  walkCollect(root, String(root.getName()), out);
  return out;
}

function findService(payload: { instanceId?: string; identifierLabel?: string }): ServiceRef {
  const services = listServices();
  const found = payload.instanceId
    ? services.find(s => s.instanceId === payload.instanceId)
    : payload.identifierLabel
      ? services.find(s => s.identifierLabel === payload.identifierLabel)
      : undefined;
  if (!found) {
    throw new Error(
      `service not found: ${payload.instanceId ?? payload.identifierLabel ?? '(no selector)'}`
    );
  }
  return found;
}

function publicState(instance: Service): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const record = instance as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.startsWith('_')) continue; // 约定：下划线开头视为私有
    out[key] = record[key];
  }
  return out;
}

export function createRabHandlers(): Record<string, DebugHandler> {
  return {
    'rab.listServices': async () =>
      listServices().map(({ instanceId, containerName, identifierLabel }) => ({
        instanceId,
        containerName,
        identifierLabel,
      })),

    'rab.getServiceState': async payload => {
      const p = (payload ?? {}) as {
        instanceId?: string;
        identifierLabel?: string;
        paths?: string[];
      };
      const ref = findService(p);
      if (p.paths && p.paths.length > 0) {
        const out: Record<string, unknown> = {};
        for (const path of p.paths) out[path] = resolvePath(ref.instance as object, path);
        const serialized = safeSerialize(out);
        if (!serialized.ok) throw new Error(serialized.error.message);
        return serialized.data;
      }
      const serialized = safeSerialize(publicState(ref.instance));
      if (!serialized.ok) throw new Error(serialized.error.message);
      return serialized.data;
    },

    'rab.callServiceMethod': async payload => {
      const p = (payload ?? {}) as { instanceId: string; method: string; args?: unknown[] };
      const ref = findService({ instanceId: p.instanceId });
      const method = (ref.instance as unknown as Record<string, unknown>)[p.method];
      if (typeof method !== 'function') {
        throw new Error(`method not found: ${p.method}`);
      }
      const raw = await (method as (...args: unknown[]) => unknown).apply(
        ref.instance,
        p.args ?? []
      );
      const serialized = safeSerialize(raw);
      if (!serialized.ok) throw new Error(serialized.error.message);
      return serialized.data;
    },

    'rab.expect': async payload => {
      const p = (payload ?? {}) as {
        instanceId: string;
        description?: string;
        assertions: Assertion[];
      };
      const ref = findService({ instanceId: p.instanceId });
      const result = executeAssertions(ref.instance as object, p.assertions ?? []);
      return {
        instanceId: p.instanceId,
        description: p.description,
        passed: result.passed,
        summary: result.summary,
        results: result.results.map(r => ({
          path: r.path,
          op: r.op,
          passed: r.passed,
          expected: r.expected,
          actual: r.actual,
          message: r.message,
        })),
      };
    },
  };
}
