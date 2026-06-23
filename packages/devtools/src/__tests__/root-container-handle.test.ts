import { createRSRootContainerHandle, setupWindowRootContainer } from '../root-container-handle';

jest.mock('@rabjs/service', () => {
  return {
    getGlobalContainer: jest.fn(),
  };
});

import { getGlobalContainer } from '@rabjs/service';

const mockGetGlobalContainer = getGlobalContainer as jest.Mock;

interface FakeContainer {
  getName: () => string;
  getServiceDefinitions: () => { instance?: Record<string, unknown> }[];
  getChildren: () => FakeContainer[];
}

function makeService(instanceId: string, data: Record<string, unknown> = {}) {
  return Object.assign({ instanceId, ...data });
}

function makeContainer(
  name: string,
  services: { instance?: ReturnType<typeof makeService> }[],
  children: FakeContainer[] = []
): FakeContainer {
  return {
    getName: () => name,
    getServiceDefinitions: () => services,
    getChildren: () => children,
  };
}

describe('createRSRootContainerHandle', () => {
  describe('listServices()', () => {
    it('returns all instantiated services across the tree', () => {
      const svcA = makeService('ServiceA#0', { count: 1 });
      const svcB = makeService('ServiceB#0', { count: 2 });
      const child = makeContainer('child', [{ instance: svcB }], []);
      const root = makeContainer('global', [{ instance: svcA }], [child]);
      mockGetGlobalContainer.mockReturnValue(root);

      const handle = createRSRootContainerHandle();
      const list = handle.listServices();

      expect(list).toHaveLength(2);
      expect(list.map(e => e.instanceId)).toEqual(['ServiceA#0', 'ServiceB#0']);
    });

    it('skips uninstantiated services (no instance)', () => {
      const root = makeContainer('global', [{ instance: undefined }], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const handle = createRSRootContainerHandle();
      expect(handle.listServices()).toHaveLength(0);
    });

    it('includes containerName and identifierLabel', () => {
      const svc = makeService('CartService#1');
      const root = makeContainer('global', [{ instance: svc }], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const [entry] = createRSRootContainerHandle().listServices();
      expect(entry.containerName).toBe('global');
      expect(entry.identifierLabel).toBe('CartService');
    });
  });

  describe('getService(instanceId)', () => {
    it('finds a service by instanceId in root', () => {
      const svc = makeService('UserService#0');
      const root = makeContainer('global', [{ instance: svc }], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const found = createRSRootContainerHandle().getService('UserService#0');
      expect(found).toBe(svc);
    });

    it('finds a service by instanceId in nested child', () => {
      const svc = makeService('DeepService#0');
      const grandchild = makeContainer('gc', [{ instance: svc }], []);
      const child = makeContainer('child', [], [grandchild]);
      const root = makeContainer('global', [], [child]);
      mockGetGlobalContainer.mockReturnValue(root);

      const found = createRSRootContainerHandle().getService('DeepService#0');
      expect(found).toBe(svc);
    });

    it('returns undefined when service not found', () => {
      const root = makeContainer('global', [], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const found = createRSRootContainerHandle().getService('Missing#0');
      expect(found).toBeUndefined();
    });
  });

  describe('getContainer(name)', () => {
    it('finds the root container by name', () => {
      const root = makeContainer('global', [], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const found = createRSRootContainerHandle().getContainer('global');
      expect(found).toBe(root);
    });

    it('finds a child container by name', () => {
      const child = makeContainer('MyComponent_0', [], []);
      const root = makeContainer('global', [], [child]);
      mockGetGlobalContainer.mockReturnValue(root);

      const found = createRSRootContainerHandle().getContainer('MyComponent_0');
      expect(found).toBe(child);
    });

    it('returns undefined when container not found', () => {
      const root = makeContainer('global', [], []);
      mockGetGlobalContainer.mockReturnValue(root);

      expect(createRSRootContainerHandle().getContainer('nonexistent')).toBeUndefined();
    });
  });

  describe('expect(instanceId)', () => {
    it('returns an RSExpectBuilder that resolves the service', () => {
      const svc = makeService('OrderService#0', { total: 42 });
      const root = makeContainer('global', [{ instance: svc }], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const result = createRSRootContainerHandle()
        .expect('OrderService#0')
        .toBe('total', 42)
        .run();

      expect(result.pass).toBe(true);
    });

    it('fails assertions when service has wrong state', () => {
      const svc = makeService('OrderService#0', { total: 0 });
      const root = makeContainer('global', [{ instance: svc }], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const result = createRSRootContainerHandle()
        .expect('OrderService#0')
        .toBe('total', 42)
        .run();

      expect(result.pass).toBe(false);
    });
  });

  describe('container property', () => {
    it('exposes the root container', () => {
      const root = makeContainer('global', [], []);
      mockGetGlobalContainer.mockReturnValue(root);

      const handle = createRSRootContainerHandle();
      expect(handle.container).toBe(root);
    });
  });
});

describe('setupWindowRootContainer', () => {
  it('attaches handle to window.__RS_ROOT_CONTAINER__', () => {
    const root = makeContainer('global', [], []);
    mockGetGlobalContainer.mockReturnValue(root);

    setupWindowRootContainer();
    expect((window as Window & { __RS_ROOT_CONTAINER__?: unknown }).__RS_ROOT_CONTAINER__).toBeDefined();
  });
});
