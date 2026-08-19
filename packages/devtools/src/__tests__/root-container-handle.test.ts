/**
 * root-container-handle 测试
 *
 * 覆盖以下场景：
 * 1. 挂载正确性：setupWindowRootContainer 调用后 window.__RS_ROOT_CONTAINER__ 存在，container 字段与 getGlobalContainer() 一致
 * 2. getService 正确性：通过 instanceId 能拿到正确的 Service 实例
 * 3. getContainer 正确性：通过 containerName 能拿到正确的 Container 实例
 * 4. listServices 正确性：多层嵌套容器时能遍历到所有已实例化的 Service
 * 5. SSR 安全见 root-container-handle.ssr.test.ts（真实 Node 环境）
 */

import { Service, getGlobalContainer, Container } from '@rabjs/service';
import { createRSRootContainerHandle, setupWindowRootContainer } from '../root-container-handle';

// 测试用 Service
class CartService extends Service {}
class ProductService extends Service {}
class UserService extends Service {}

describe('root-container-handle', () => {
  // 每个测试前后清理 window 上的挂载，保证测试隔离
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      delete (window as any).__RS_ROOT_CONTAINER__;
    }
  });

  // ============================================================
  // 1. createRSRootContainerHandle 正确性
  // ============================================================
  describe('createRSRootContainerHandle', () => {
    it('container 字段应与 getGlobalContainer() 返回同一对象引用', () => {
      const handle = createRSRootContainerHandle();
      expect(handle.container).toBe(getGlobalContainer());
    });

    it('handle 应包含 getService、getContainer、listServices 三个方法', () => {
      const handle = createRSRootContainerHandle();
      expect(typeof handle.getService).toBe('function');
      expect(typeof handle.getContainer).toBe('function');
      expect(typeof handle.listServices).toBe('function');
    });
  });

  // ============================================================
  // 2. getService 正确性
  // ============================================================
  describe('getService', () => {
    it('通过有效 instanceId 能获取到正确的 Service 实例', () => {
      const container = new Container({ name: 'TestGetService', parent: getGlobalContainer() });
      container.register(CartService);
      const svc = container.resolve(CartService);

      const handle = createRSRootContainerHandle();
      expect(handle.getService(svc.instanceId)).toBe(svc);
    });

    it('传入不存在的 instanceId 返回 undefined', () => {
      const handle = createRSRootContainerHandle();
      expect(handle.getService('NonExistent_99999')).toBeUndefined();
    });

    it('能在多层嵌套容器中找到深层 Service', () => {
      const parent = new Container({ name: 'ParentGetService', parent: getGlobalContainer() });
      const child = new Container({ name: 'ChildGetService', parent });

      child.register(ProductService);
      const svc = child.resolve(ProductService);

      const handle = createRSRootContainerHandle();
      expect(handle.getService(svc.instanceId)).toBe(svc);
    });
  });

  // ============================================================
  // 3. getContainer 正确性
  // ============================================================
  describe('getContainer', () => {
    it('通过有效 containerName 能获取到正确的 Container 实例', () => {
      const container = new Container({ name: 'MyNamedContainer', parent: getGlobalContainer() });

      const handle = createRSRootContainerHandle();
      expect(handle.getContainer('MyNamedContainer')).toBe(container);
    });

    it('传入不存在的 containerName 返回 undefined', () => {
      const handle = createRSRootContainerHandle();
      expect(handle.getContainer('NonExistentContainer_99999')).toBeUndefined();
    });

    it('global 容器本身可以通过名称 "global" 获取', () => {
      const handle = createRSRootContainerHandle();
      expect(handle.getContainer('global')).toBe(getGlobalContainer());
    });

    it('能在多层嵌套中找到深层容器', () => {
      const parent = new Container({ name: 'DeepParent', parent: getGlobalContainer() });
      const child = new Container({ name: 'DeepChild', parent });

      const handle = createRSRootContainerHandle();
      expect(handle.getContainer('DeepChild')).toBe(child);
    });
  });

  // ============================================================
  // 4. listServices 正确性
  // ============================================================
  describe('listServices', () => {
    it('返回数组中包含已实例化的 Service，instance 字段为内存对象引用', () => {
      const container = new Container({ name: 'ListServicesTest', parent: getGlobalContainer() });
      container.register(UserService);
      const svc = container.resolve(UserService);

      const handle = createRSRootContainerHandle();
      const list = handle.listServices();

      const found = list.find(item => item.instanceId === svc.instanceId);
      expect(found).toBeDefined();
      expect(found!.instance).toBe(svc); // 必须是同一内存引用
      expect(found!.containerName).toBe('ListServicesTest');
      expect(found!.identifierLabel).toBe('UserService');
    });

    it('多层嵌套容器时能遍历到所有已实例化的 Service', () => {
      const parent = new Container({ name: 'ListParent', parent: getGlobalContainer() });
      const child = new Container({ name: 'ListChild', parent });

      parent.register(CartService);
      child.register(ProductService);

      const cartSvc = parent.resolve(CartService);
      const productSvc = child.resolve(ProductService);

      const handle = createRSRootContainerHandle();
      const list = handle.listServices();

      const instanceIds = list.map(item => item.instanceId);
      expect(instanceIds).toContain(cartSvc.instanceId);
      expect(instanceIds).toContain(productSvc.instanceId);
    });

    it('未实例化的 Service（未被 resolve）不出现在列表中', () => {
      const container = new Container({ name: 'ListUnresolved', parent: getGlobalContainer() });
      container.register(CartService);
      // 不调用 resolve，CartService 不会被实例化

      const handle = createRSRootContainerHandle();
      const list = handle.listServices();

      // 获取 ListUnresolved 容器中的 Service 列表，应为空
      const fromThisContainer = list.filter(item => item.containerName === 'ListUnresolved');
      expect(fromThisContainer).toHaveLength(0);
    });

    it('返回的 instance 修改后能即时反映到应用状态（内存对象引用验证）', () => {
      const container = new Container({ name: 'ListRefTest', parent: getGlobalContainer() });
      container.register(UserService);
      const svc = container.resolve(UserService);

      const handle = createRSRootContainerHandle();
      const found = handle.listServices().find(item => item.instance === svc);
      expect(found).toBeDefined();

      // 修改通过 listServices 获取的 instance 应该与原对象一致
      (found!.instance as any).__test_flag__ = 42;
      expect((svc as any).__test_flag__).toBe(42);
    });

    it('使用字符串标识符注册的 Service，identifierLabel 应为字符串标识符', () => {
      const container = new Container({ name: 'ListStringIdTest', parent: getGlobalContainer() });
      // 以字符串作为标识符注册 Service（identifier 不是函数，走 String(def.identifier) 分支）
      container.register('myStringService', UserService);
      container.resolve('myStringService');

      const handle = createRSRootContainerHandle();
      const list = handle.listServices();

      const found = list.find(item => item.containerName === 'ListStringIdTest');
      expect(found).toBeDefined();
      expect(found!.identifierLabel).toBe('myStringService');
    });

    it('匿名函数 identifier（无 name 属性）时，identifierLabel 应为 AnonymousService', () => {
      const container = new Container({ name: 'ListAnonTest', parent: getGlobalContainer() });
      // 构造一个匿名类（name 为空字符串）来触发 'AnonymousService' fallback
      const AnonService = class extends Service {};
      Object.defineProperty(AnonService, 'name', { value: '' });
      container.register(AnonService);
      container.resolve(AnonService);

      const handle = createRSRootContainerHandle();
      const list = handle.listServices();

      const found = list.find(item => item.containerName === 'ListAnonTest');
      expect(found).toBeDefined();
      expect(found!.identifierLabel).toBe('AnonymousService');
    });
  });

  // ============================================================
  // 5. setupWindowRootContainer - 浏览器环境挂载
  // ============================================================
  describe('setupWindowRootContainer', () => {
    it('在浏览器环境下应挂载 window.__RS_ROOT_CONTAINER__', () => {
      setupWindowRootContainer();
      expect((window as any).__RS_ROOT_CONTAINER__).toBeDefined();
    });

    it('挂载后 container 字段与 getGlobalContainer() 一致', () => {
      setupWindowRootContainer();
      expect((window as any).__RS_ROOT_CONTAINER__.container).toBe(getGlobalContainer());
    });

    it('挂载后 window.__RS_ROOT_CONTAINER__ 具有 getService、getContainer、listServices 方法', () => {
      setupWindowRootContainer();
      const handle = (window as any).__RS_ROOT_CONTAINER__;
      expect(typeof handle.getService).toBe('function');
      expect(typeof handle.getContainer).toBe('function');
      expect(typeof handle.listServices).toBe('function');
    });
  });
});
