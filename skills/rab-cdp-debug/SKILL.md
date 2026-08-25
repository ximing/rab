---
name: rab-cdp-debug
description: 用于指导 Agent 通过 Chrome DevTools MCP 的 `evaluate_script` 工具，结合 `window.__RS_ROOT_CONTAINER__` API 对 `@rabjs/react` 应用进行逻辑验证。当用户提到 Service 逻辑验证、Chrome DevTools 调试 Service、CDP 操控 rsjs Service、浏览器页面中调试 Service 实例 时，应优先使用这个 skill。适用场景包括：使用 chrome-devtools-mcp 的 evaluate_script 访问 Service 实例、验证 Service 状态、调用 Service 方法、通过 listServices 枚举当前页面所有 Service。
version: 0.2.10-beta.0
npm: '@rabjs/devtools'
sourcePath: packages/react
repository: git@github.com:ximing/rab.git
---

# window.**RS_ROOT_CONTAINER** 调试指南（Chrome DevTools MCP）

本 skill 告知 Agent 如何通过 **Chrome DevTools MCP** 的 `evaluate_script` 工具，利用 `@rabjs/devtools` 挂载的 `window.__RS_ROOT_CONTAINER__` 能力，对 Service 层进行功能验证与状态检查。

---

## 前置条件：初始化挂载

`window.__RS_ROOT_CONTAINER__` **不会自动挂载**，必须由应用入口显式初始化。

1. 安装依赖：

```bash
pnpm add @rabjs/devtools
```

2. 在应用入口（如 `main.tsx`）调用一次：

```ts
import { setupWindowRootContainer } from '@rabjs/devtools';

setupWindowRootContainer();
```

如果目标页面尚未接入，先引导用户完成上述初始化步骤，再进行后续调试。SSR 安全：非浏览器环境下调用会自动跳过。

---

## 能力概述

`window.__RS_ROOT_CONTAINER__` 是 `setupWindowRootContainer()` 在浏览器环境下挂载的全局访问句柄，暴露整棵容器树的查询接口。

**挂载时机**：应用入口调用 `setupWindowRootContainer()` 时。

### 容器树结构

```
global (getGlobalContainer())           ← 真正的根，与 React 无关
  └─ RSRootInner_1                      ← RSRoot 的 bindServices 容器
       └─ ProductPage_2                 ← 页面级 bindServices 容器
            └─ CartDomain_3             ← Domain 级 bindServices 容器
```

### RSRootContainerHandle 接口

```ts
interface RSRootContainerHandle {
  container: Container; // global 容器实例
  getService(instanceId: string): Service | undefined;
  getContainer(containerName: string): Container | undefined;
  listServices(): Array<{
    instanceId: string; // 格式: ClassName_nanoid
    containerName: string; // 来自 bindServices options.name 或自动生成
    identifierLabel: string; // Service 类名
    instance: Service; // 内存对象引用，可直接操控
  }>;
}
```

---

## evaluate_script 工具使用说明

Chrome DevTools MCP 提供 `evaluate_script` 工具，可在当前选中页面内执行 JavaScript 函数，**返回值必须是 JSON 可序列化的**。

```
function (string) (required): JavaScript 函数声明
  示例无参数: () => { return document.title }
  示例有参数: (el) => { return el.innerText; }
args (array) (optional): 传入函数的参数列表
```

> **关键约束**：Service 实例本身不可序列化跨进程传递，必须在 `evaluate_script` 内部完成操作，只将基础类型（数字、字符串、布尔、普通对象）作为结果返回。

---

## 常用调试操作

### 1. 检查 handle 是否已挂载

```js
() => {
  return typeof window.__RS_ROOT_CONTAINER__;
};
// 期望返回: "object"
```

### 2. 列出所有已实例化的 Service

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '__RS_ROOT_CONTAINER__ 未挂载' };
  return handle.listServices().map(s => ({
    instanceId: s.instanceId,
    containerName: s.containerName,
    identifierLabel: s.identifierLabel,
  }));
};
```

返回示例：

```json
[
  {
    "instanceId": "CartService_abc12",
    "containerName": "ProductPage_2",
    "identifierLabel": "CartService"
  },
  {
    "instanceId": "UserService_xyz99",
    "containerName": "RSRootInner_1",
    "identifierLabel": "UserService"
  }
]
```

### 3. 通过 instanceId 获取 Service 状态

先通过 `listServices` 获得 `instanceId`，再读取 Service 内部状态：

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '__RS_ROOT_CONTAINER__ 未挂载' };
  const svc = handle.getService('CartService_abc12');
  if (!svc) return { error: '未找到指定 Service' };
  // 返回可序列化的状态字段
  return {
    itemCount: svc.items?.length ?? 0,
    total: svc.total,
  };
};
```

### 4. 通过 identifierLabel 查找 Service

当不知道具体 `instanceId` 时，先通过类名找到：

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return null;
  const entry = handle.listServices().find(s => s.identifierLabel === 'CartService');
  if (!entry) return { error: 'CartService 未找到' };
  return {
    instanceId: entry.instanceId,
    containerName: entry.containerName,
  };
};
```

### 5. 调用 Service 方法并验证结果

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '__RS_ROOT_CONTAINER__ 未挂载' };
  const entry = handle.listServices().find(s => s.identifierLabel === 'CartService');
  if (!entry) return { error: 'CartService 未找到' };
  const svc = entry.instance;
  // 调用方法
  svc.addItem({ id: 'test-1', name: 'Test Product', price: 9.9 });
  // 返回可序列化的验证结果
  return {
    itemCount: svc.items.length,
    lastItem: svc.items[svc.items.length - 1],
  };
};
```

### 6. 调用异步 Service 方法

```js
async () => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '__RS_ROOT_CONTAINER__ 未挂载' };
  const entry = handle.listServices().find(s => s.identifierLabel === 'ProductService');
  if (!entry) return { error: 'ProductService 未找到' };
  const svc = entry.instance;
  await svc.fetchProducts();
  return {
    productCount: svc.products.length,
    loadingState: svc.loadingState,
  };
};
```

### 7. 通过 containerName 查找特定容器内的 Service

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return null;
  return handle
    .listServices()
    .filter(s => s.containerName === 'ProductPage_2')
    .map(s => ({ instanceId: s.instanceId, identifierLabel: s.identifierLabel }));
};
```

### 8. 重置 Service 状态（验证后清理）

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '__RS_ROOT_CONTAINER__ 未挂载' };
  const entry = handle.listServices().find(s => s.identifierLabel === 'CartService');
  if (!entry) return { error: '未找到' };
  entry.instance.clearCart?.();
  return { cleared: true, itemCount: entry.instance.items?.length ?? 0 };
};
```

---

## 典型验证流程

**Step 1**：确认 handle 存在

```js
() => typeof window.__RS_ROOT_CONTAINER__;
// 期望: "object"
```

**Step 2**：枚举所有 Service，找到目标

```js
() =>
  window.__RS_ROOT_CONTAINER__?.listServices().map(s => ({
    instanceId: s.instanceId,
    identifierLabel: s.identifierLabel,
    containerName: s.containerName,
  }));
```

**Step 3**：取出 Service 当前状态快照

```js
() => {
  const svc = window.__RS_ROOT_CONTAINER__?.getService('CartService_abc12');
  return svc ? { total: svc.total, count: svc.items.length } : null;
};
```

**Step 4**：触发操作

```js
() => {
  const entry = window.__RS_ROOT_CONTAINER__
    ?.listServices()
    .find(s => s.identifierLabel === 'CartService');
  entry?.instance.addItem({ id: '1', name: 'Apple', price: 5 });
  return { ok: true };
};
```

**Step 5**：验证状态变更

```js
() => {
  const svc = window.__RS_ROOT_CONTAINER__?.getService('CartService_abc12');
  return { total: svc?.total, count: svc?.items.length };
};
```

---

## 断言用法

`@rabjs/devtools` 提供了 **RSExpectBuilder** 链式断言 API，可以直接通过 `window.__RS_ROOT_CONTAINER__.expect(instanceId)` 创建，也可以通过独立函数 `rsExpect(instance)` 使用。

### 核心概念

- **懒执行**：`toBe()` / `toExist()` 等方法只记录断言，不立即执行
- **链式调用**：所有断言方法返回 `this`，可无限链式调用
- **三种执行模式**：
  - `.run()` — 返回结构化结果对象，不抛错
  - `.check()` — 控制台输出彩色报告，返回 `boolean`
  - `.expect()` — 失败时抛出 `RSAssertionError`（类 Jest 语义）

### 路径语法

所有断言方法的 `path` 参数支持点号路径，用于深层属性访问：

```
'total'              → svc.total
'items.length'       → svc.items.length
'user.profile.name'  → svc.user.profile.name
```

---

### 断言方法速查表

| 方法                               | 说明                     | op            |
| ---------------------------------- | ------------------------ | ------------- |
| `.toBe(path, expected)`            | `actual === expected`    | `eq`          |
| `.notToBe(path, expected)`         | `actual !== expected`    | `neq`         |
| `.toBeGreaterThan(path, n)`        | `actual > n`             | `gt`          |
| `.toBeGreaterThanOrEqual(path, n)` | `actual >= n`            | `gte`         |
| `.toBeLessThan(path, n)`           | `actual < n`             | `lt`          |
| `.toBeLessThanOrEqual(path, n)`    | `actual <= n`            | `lte`         |
| `.toBeBetween(path, lo, hi)`       | `lo <= actual <= hi`     | `between`     |
| `.toExist(path)`                   | `actual != null`         | `exists`      |
| `.toNotExist(path)`                | `actual == null`         | `notExists`   |
| `.toInclude(path, item)`           | 数组/字符串包含          | `includes`    |
| `.toNotInclude(path, item)`        | 数组/字符串不包含        | `notIncludes` |
| `.toMatch(path, pattern)`          | 正则匹配                 | `matches`     |
| `.toBeType(path, type)`            | `typeof actual === type` | `type`        |
| `.toHaveLength(path, n)`           | `actual.length === n`    | `length`      |
| `.toHaveLengthGt(path, n)`         | `actual.length > n`      | `lengthGt`    |
| `.toHaveLengthGte(path, n)`        | `actual.length >= n`     | `lengthGte`   |
| `.toHaveLengthLt(path, n)`         | `actual.length < n`      | `lengthLt`    |
| `.toHaveLengthLte(path, n)`        | `actual.length <= n`     | `lengthLte`   |
| `.toHaveKeys(path, keys)`          | 对象包含所有指定 key     | `hasKeys`     |
| `.toMatchObject(path, subset)`     | 对象浅层匹配子集         | `matchObject` |
| `.toDeepEqual(path, expected)`     | JSON 深比较              | `deepEq`      |
| `.toHaveSome(path, assertion)`     | 数组中至少一项满足       | `some`        |
| `.toHaveEvery(path, assertion)`    | 数组所有项满足           | `every`       |

---

### 基本示例：控制台调试（`.check()`）

控制台快速验证，带彩色报告输出，返回 `boolean`：

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '未挂载' };
  return handle
    .expect('CartService_abc123')
    .describe('购物车基础验证')
    .toBe('items.length', 3)
    .toExist('currentUser')
    .toBeGreaterThan('total', 0)
    .check(); // 控制台输出报告，返回 true/false
};
```

> **注意**：`.check()` 直接向控制台打印，`evaluate_script` 只需返回布尔值即可。

---

### 获取结构化结果（`.run()`）

`.run()` 返回可 JSON 序列化的结构化结果，适合 evaluate_script 跨进程传递：

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '未挂载' };
  const result = handle
    .expect('CartService_abc123')
    .toBe('items.length', 3)
    .toBeGreaterThan('total', 0)
    .toExist('currentUser')
    .run();
  // 返回可序列化的结构化断言结果
  return {
    passed: result.passed,
    summary: result.summary, // { passed: 2, total: 3 }
    results: result.results.map(r => ({
      path: r.path,
      op: r.op,
      passed: r.passed,
      expected: r.expected,
      actual: r.actual,
    })),
  };
};
```

返回示例：

```json
{
  "passed": false,
  "summary": { "passed": 2, "total": 3 },
  "results": [
    { "path": "items.length", "op": "eq", "passed": true, "expected": 3, "actual": 3 },
    { "path": "total", "op": "gt", "passed": true, "expected": 0, "actual": 29.7 },
    { "path": "currentUser", "op": "exists", "passed": false, "expected": null, "actual": null }
  ]
}
```

---

### 强断言模式（`.expect()`，类 Jest 语义）

失败时抛出 `RSAssertionError`，适合 E2E 测试脚本：

```js
async () => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) throw new Error('未挂载');
  try {
    handle.expect('CartService_abc123').toBe('items.length', 3).toExist('currentUser').expect(); // 失败时抛出 RSAssertionError
    return { passed: true };
  } catch (e) {
    return { passed: false, message: e.message };
  }
};
```

---

### 各类断言示例

#### 相等与不等

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('UserService_xyz99')
    .toBe('loginState', 'logged_in') // 精确相等
    .notToBe('errorCode', 403) // 不等于
    .check();
};
```

#### 数值比较

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('CartService_abc123')
    .toBeGreaterThan('total', 0) // > 0
    .toBeGreaterThanOrEqual('items.length', 1) // >= 1
    .toBeLessThan('items.length', 100) // < 100
    .toBeBetween('total', 10, 500) // 10 <= total <= 500
    .check();
};
```

#### 存在性检查

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('UserService_xyz99')
    .toExist('currentUser') // 不为 null/undefined
    .toExist('currentUser.token') // 深层路径存在性
    .toNotExist('errorMessage') // 为 null/undefined
    .check();
};
```

#### 数组与字符串包含

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('ProductService_p001')
    .toInclude('tags', 'featured') // 数组包含元素
    .toNotInclude('disabledFeatures', 'checkout') // 数组不包含
    .toInclude('title', 'iPhone') // 字符串包含子串
    .check();
};
```

#### 正则匹配

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('UserService_xyz99')
    .toMatch('email', '^\\w+@\\w+\\.\\w+$') // 正则匹配 email 格式
    .toMatch('phone', '^\\+?[0-9]{7,15}$')
    .check();
};
```

#### 类型检查

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('CartService_abc123')
    .toBeType('total', 'number') // typeof total === 'number'
    .toBeType('items', 'object') // typeof items === 'object'（数组也是 object）
    .toBeType('isLoading', 'boolean')
    .check();
};
```

#### 长度断言

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('CartService_abc123')
    .toHaveLength('items', 3) // 精确长度
    .toHaveLengthGt('items', 0) // 非空
    .toHaveLengthLte('items', 10) // 不超过 10
    .check();
};
```

#### 对象键与子集匹配

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('UserService_xyz99')
    .toHaveKeys('currentUser', ['id', 'name', 'email']) // 包含所有指定 key
    .toMatchObject('currentUser', { role: 'admin', active: true }) // 浅层子集
    .toDeepEqual('config', { theme: 'dark', lang: 'zh' }) // 深比较
    .check();
};
```

#### 数组元素断言（some / every）

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return (
    handle
      .expect('CartService_abc123')
      // 至少一个商品价格 > 100
      .toHaveSome('items', { path: 'price', op: 'gt', expected: 100 })
      // 所有商品数量 >= 1
      .toHaveEvery('items', { path: 'quantity', op: 'gte', expected: 1 })
      .check()
  );
};
```

#### 带自定义错误信息

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  return handle
    .expect('CartService_abc123')
    .toBe('items.length', 3, '购物车应有 3 个商品')
    .toExist('currentUser', '用户未登录')
    .check();
};
```

---

### 独立使用 `rsExpect(instance)`

脱离 `window` 挂载，直接传入 Service 实例，适合 E2E 测试框架或 Node.js 环境：

```js
// E2E 测试脚本中
import { rsExpect } from '@rabjs/devtools';

// 直接传 Service 实例
rsExpect(cartService, '购物车加购验证')
  .toBe('items.length', 1)
  .toBe('items.0.name', 'iPhone 15')
  .toBeGreaterThan('total', 0)
  .expect(); // 失败时抛出 RSAssertionError
```

在 evaluate_script 中组合使用（先取实例，再建立断言）：

```js
() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '未挂载' };
  // 通过类名找到 Service 实例
  const entry = handle.listServices().find(s => s.identifierLabel === 'CartService');
  if (!entry) return { error: 'CartService 未找到' };
  // 直接对实例进行断言（等价于 handle.expect(instanceId)）
  const result = handle
    .expect(entry.instanceId)
    .describe('加购后状态验证')
    .toHaveLength('items', 1)
    .toBeGreaterThan('total', 0)
    .run();
  return { passed: result.passed, summary: result.summary };
};
```

---

### 断言 + 操作组合流程

先操作 Service，再断言状态变更：

```js
async () => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: '未挂载' };

  const entry = handle.listServices().find(s => s.identifierLabel === 'CartService');
  if (!entry) return { error: 'CartService 未找到' };

  // 1. 记录操作前状态
  const before = handle.expect(entry.instanceId).toBe('items.length', 0).run();

  // 2. 触发操作
  await entry.instance.addItem({ id: 'test-1', name: 'Test Product', price: 9.9 });

  // 3. 断言操作后状态
  const after = handle
    .expect(entry.instanceId)
    .toBe('items.length', 1)
    .toBeGreaterThan('total', 0)
    .run();

  return {
    before: { passed: before.passed, summary: before.summary },
    after: { passed: after.passed, summary: after.summary },
  };
};
```

---

## 常见问题

### `window.__RS_ROOT_CONTAINER__` 为 undefined？

- 页面未完成加载，稍等后重试

### `getService` 找不到 Service？

- 只有调用 `resolve` 后被实例化的 Singleton 才会出现
- 先用 `listServices()` 确认实例是否已存在及其 `instanceId`

### evaluate_script 返回值为 undefined / 不完整？

- 返回值必须是 JSON 可序列化的类型（基础类型、普通对象、数组）
- Service 实例不可直接返回，需提取其中的状态字段
- 避免返回含循环引用的对象
