import { raw } from "@rabjs/observer";
import EventEmitter from "eventemitter3";

import { EventSystem, type EventScope } from "./event";
import { Container } from "./ioc";

export interface EventListenerRecord {
  eventName: string;
  scope: EventScope;
  emitter: EventEmitter;
  originalHandler: (...args: any[]) => void;
  subscribedHandler: (...args: any[]) => void;
  once: boolean;
  source: "manual" | "decorator";
  active: boolean;
}

export interface BindTrackedEventListenerOptions {
  eventName: string;
  handler: (...args: any[]) => void;
  scope: EventScope;
  once: boolean;
  container?: Container;
  source: "manual" | "decorator";
}

export interface UnbindTrackedEventListenerOptions {
  eventName?: string;
  handler?: (...args: any[]) => void;
  scope?: EventScope;
  limit?: number;
}

const EVENT_LISTENER_REGISTRY = Symbol("rs-service:event-listener-registry");

type RegistryCarrier = {
  [EVENT_LISTENER_REGISTRY]?: EventListenerRecord[];
};

function normalizeTarget<T extends object>(value: T): T {
  return raw(value);
}

function getRegistryCarrier(service: object): RegistryCarrier {
  return normalizeTarget(service) as RegistryCarrier;
}

function ensureRegistry(service: object): EventListenerRecord[] {
  const carrier = getRegistryCarrier(service);

  if (!carrier[EVENT_LISTENER_REGISTRY]) {
    Object.defineProperty(carrier, EVENT_LISTENER_REGISTRY, {
      value: [],
      writable: true,
      configurable: true,
    });
  }

  return carrier[EVENT_LISTENER_REGISTRY]!;
}

function removeRecord(service: object, record: EventListenerRecord): void {
  const registry = getRegistryCarrier(service)[EVENT_LISTENER_REGISTRY];

  if (!registry?.length) {
    return;
  }

  const index = registry.indexOf(record);
  if (index !== -1) {
    registry.splice(index, 1);
  }
}

function resolveContainer(
  service: object,
  container?: Container
): Container | undefined {
  if (container) {
    return normalizeTarget(container);
  }

  const ownContainer = (normalizeTarget(service) as { _container?: Container })._container;
  if (ownContainer) {
    return normalizeTarget(ownContainer);
  }

  const resolvedContainer = Container.getContainerOf?.(normalizeTarget(service));
  return resolvedContainer ? normalizeTarget(resolvedContainer) : resolvedContainer;
}

function matchesRecord(
  record: EventListenerRecord,
  options: UnbindTrackedEventListenerOptions
): boolean {
  if (!record.active) {
    return false;
  }

  if (options.eventName && record.eventName !== options.eventName) {
    return false;
  }

  if (options.scope && record.scope !== options.scope) {
    return false;
  }

  if (options.handler && record.originalHandler !== options.handler) {
    return false;
  }

  return true;
}

export function bindTrackedEventListener(
  service: object,
  options: BindTrackedEventListenerOptions
): EventListenerRecord {
  const { eventName, handler, scope, once, container, source } = options;
  const originalHandler = normalizeTarget(
    handler as unknown as object
  ) as (...args: any[]) => void;
  const emitter = normalizeTarget(
    EventSystem.getEmitter(scope, resolveContainer(service, container))
  ) as EventEmitter;

  const record: EventListenerRecord = {
    eventName,
    scope,
    emitter,
    originalHandler,
    subscribedHandler: once
      ? (...args: any[]) => {
          try {
            originalHandler(...args);
          } finally {
            unbindTrackedEventListener(service, record);
          }
        }
      : originalHandler,
    once,
    source,
    active: true,
  };

  emitter.on(eventName, record.subscribedHandler);
  ensureRegistry(service).push(record);

  return record;
}

export function unbindTrackedEventListener(
  service: object,
  record: EventListenerRecord
): boolean {
  const normalizedRecord = normalizeTarget(record as unknown as object) as EventListenerRecord;

  if (!normalizedRecord.active) {
    removeRecord(service, normalizedRecord);
    return false;
  }

  normalizedRecord.active = false;
  normalizedRecord.emitter.off(
    normalizedRecord.eventName,
    normalizedRecord.subscribedHandler
  );
  removeRecord(service, normalizedRecord);
  return true;
}

export function unbindTrackedEventListeners(
  service: object,
  options: UnbindTrackedEventListenerOptions = {}
): number {
  const registry = getTrackedEventListenerRecords(service);
  if (registry.length === 0) {
    return 0;
  }

  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const recordsToRemove: EventListenerRecord[] = [];

  for (const record of registry) {
    if (!matchesRecord(record, {
      ...options,
      handler: options.handler
        ? (normalizeTarget(options.handler as unknown as object) as (...args: any[]) => void)
        : undefined,
    })) {
      continue;
    }

    recordsToRemove.push(record);
    if (recordsToRemove.length >= limit) {
      break;
    }
  }

  for (const record of recordsToRemove) {
    unbindTrackedEventListener(service, record);
  }

  return recordsToRemove.length;
}

export function cleanupTrackedEventListeners(service: object): void {
  const registry = getTrackedEventListenerRecords(service);
  if (registry.length === 0) {
    return;
  }

  for (const record of registry) {
    unbindTrackedEventListener(service, record);
  }

  const carrier = getRegistryCarrier(service);
  if (carrier[EVENT_LISTENER_REGISTRY]) {
    carrier[EVENT_LISTENER_REGISTRY] = [];
  }
}

export function getTrackedEventListenerRecords(
  service: object
): EventListenerRecord[] {
  const registry = getRegistryCarrier(service)[EVENT_LISTENER_REGISTRY];
  return registry ? registry.filter((record) => record.active) : [];
}
