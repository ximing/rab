import { Container, Service, getGlobalContainer } from '@rabjs/service';

import { RSExpectBuilder } from './assert/expect';

export interface ServiceEntry {
  instanceId: string;
  containerName: string | symbol;
  identifierLabel: string;
  instance: Service;
}

export interface RSRootContainerHandle {
  container: Container;
  getService(instanceId: string): Service | undefined;
  getContainer(containerName: string): Container | undefined;
  listServices(): ServiceEntry[];
  expect(instanceId: string): RSExpectBuilder;
}

function walkContainerForInstanceId(
  container: Container,
  instanceId: string
): Service | undefined {
  for (const def of container.getServiceDefinitions()) {
    if (def.instance && (def.instance as Service).instanceId === instanceId) {
      return def.instance as Service;
    }
  }
  for (const child of container.getChildren()) {
    const found = walkContainerForInstanceId(child, instanceId);
    if (found) return found;
  }
  return undefined;
}

function walkContainerForName(
  container: Container,
  containerName: string
): Container | undefined {
  if (container.getName() === containerName) return container;
  for (const child of container.getChildren()) {
    const found = walkContainerForName(child, containerName);
    if (found) return found;
  }
  return undefined;
}

function collectServices(container: Container, results: ServiceEntry[]): void {
  const containerName = container.getName() as string | symbol;
  for (const def of container.getServiceDefinitions()) {
    const instance = def.instance as Service | undefined;
    if (instance && instance.instanceId) {
      results.push({
        instanceId: instance.instanceId,
        containerName,
        identifierLabel: instance.instanceId.split('#')[0],
        instance,
      });
    }
  }
  for (const child of container.getChildren()) {
    collectServices(child, results);
  }
}

export function createRSRootContainerHandle(): RSRootContainerHandle {
  const root = getGlobalContainer();

  return {
    container: root,

    getService(instanceId: string): Service | undefined {
      return walkContainerForInstanceId(root, instanceId);
    },

    getContainer(containerName: string): Container | undefined {
      return walkContainerForName(root, containerName);
    },

    listServices(): ServiceEntry[] {
      const results: ServiceEntry[] = [];
      collectServices(root, results);
      return results;
    },

    expect(instanceId: string): RSExpectBuilder {
      return new RSExpectBuilder(instanceId, (id) => this.getService(id));
    },
  };
}

export function setupWindowRootContainer(): void {
  if (typeof globalThis.window !== 'undefined') {
    (window as Window & { __RS_ROOT_CONTAINER__?: RSRootContainerHandle }).__RS_ROOT_CONTAINER__ =
      createRSRootContainerHandle();
  }
}
