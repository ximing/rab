# `@rabjs/devtools` 断言能力技术方案

## 背景与动机

### 现状

`@rabjs/devtools` 目前只提供了容器访问桥接能力（`window.__RS_ROOT_CONTAINER__`），开发者在 Chrome DevTools 控制台调试时只能手动访问 Service 实例属性，无法以结构化方式做状态验证：

```js
// 现状：手工对比，无法批量、无报告
const svc = window.__RS_ROOT_CONTAINER__.getService('CartService_abc');
console.log(svc.items.length); // 手动检查，无断言语义
```

### 目标

为 `@rabjs/devtools` 增加**类 Jest 断言 API**，让开发者在 Chrome DevTools 控制台（或 E2E 测试脚本）中通过 fluent chain 方式对 RSJS Service 状态做精准验证：

```js
// 目标：声明式断言，带报告
window.__RS_ROOT_CONTAINER__
  .expect('CartService_abc')
  .toBe('items.length', 3)
  .toExist('items.0.productId')
  .run(); // => { passed: true, summary: { passed: 2, total: 2 }, results: [...] }
```

### 与 `@rabjs/web-mcp` assert_state 的区别

| 对比项             | `rs-web-mcp` assert_state                   | `rs-cdp-debug` expect API                            |
| ------------------ | ------------------------------------------- | ---------------------------------------------------- |
| 目标用户           | AI Agent（LLM 调用）                        | 开发者（控制台 / E2E）                               |
| 调用方式           | JSON 描述对象 + execute()                   | Fluent chain API                                     |
| 错误报告           | JSON 结构，供程序消费                       | 友好字符串 + console 彩色输出                        |
| 断言核心逻辑       | `utils/assert.ts` + `utils/resolve-path.ts` | **共同依赖 `@rabjs/shared`**                         |
| 与 window 挂载集成 | 否（通过 McpRegistry 注册）                 | 是（挂载到 `window.__RS_ROOT_CONTAINER__.expect()`） |

**核心设计决策**：`rs-cdp-debug` 的断言能力 **不重新实现断言内核**，也不从 `rs-web-mcp` vendor 复制代码，而是将断言相关的公共逻辑（类型定义、路径解析、操作符执行）**提取到独立的 `@rabjs/shared` 包**，由 `rs-web-mcp` 和 `rs-cdp-debug` 共同依赖。

---

## 整体架构

### 包依赖关系（更新后）

```
@rabjs/observer          ← 响应式内核
@rabjs/service           ← IOC 容器
      │
      ├── @rabjs/react     ← React 集成
      │
      ├── @rabjs/shared    ← NEW：跨包复用的公共工具（断言内核、路径解析等）
      │         │
      │         ├── @rabjs/web-mcp  ← AI Agent 工具（assert_state 等）
      │         │
      │         └── @rabjs/devtools  ← 开发者调试工具（增加断言能力）
      │                  │
      │                  ├── window.__RS_ROOT_CONTAINER__.listServices()
      │                  ├── window.__RS_ROOT_CONTAINER__.getService()
      │                  ├── window.__RS_ROOT_CONTAINER__.getContainer()
      │                  └── window.__RS_ROOT_CONTAINER__.expect()  ← NEW
```

`rs-shared` 是**纯工具包**，无运行时副作用，零依赖（不依赖 `rs-service` / `rs-observer`），可在任意环境（浏览器、Node.js、Web Worker）安全引入。`rs-web-mcp` 和 `rs-cdp-debug` 均将其列为 `dependencies`。

---

## 文件结构（新增部分）

### 新建：`@rabjs/shared` 共享包

```
reactive-state/shared/                    ← NEW 包根目录
├── package.json                          ← name: @rabjs/shared，零运行时依赖
├── tsconfig.json
├── build.config.ts
├── jest.config.js
├── eslint.config.js
└── src/
    ├── main.ts                           ← 包入口，re-export 所有公共 API
    ├── assert/
    │   ├── types.ts                      ← 断言类型定义（AssertOp、Assertion、AssertionResult 等）
    │   ├── resolve-path.ts               ← 点分路径解析工具（resolvePath、toSafeActual）
    │   └── operators.ts                  ← 断言操作符执行逻辑（executeAssertion、executeAssertions）
    └── __tests__/
        └── assert/
            ├── resolve-path.test.ts
            └── operators.test.ts
```

### 变更：`@rabjs/devtools`

```
reactive-state/cdp-debug/src/
├── main.ts                          ← 包入口（新增 expect 相关导出）
├── root-container-handle.ts         ← 已有：容器访问桥接
├── types/
│   └── window.d.ts                  ← 已有：Window 类型扩展
├── assert/                          ← NEW：断言能力模块（依赖 @rabjs/shared）
│   ├── expect.ts                    ← Fluent Expect Builder（核心新增）
│   └── reporter.ts                  ← 控制台友好报告输出
└── __tests__/
    ├── root-container-handle.test.ts ← 已有
    └── assert/                       ← NEW
        └── expect.test.ts
```

### 变更：`@rabjs/web-mcp`

```
reactive-state/web-mcp/src/
├── utils/
│   ├── assert.ts       ← 改为从 @rabjs/shared re-export（或直接删除，改用 shared）
│   ├── resolve-path.ts ← 同上
│   ...
```

---

## 类型设计（`@rabjs/shared` 的 `assert/types.ts`）

从 `rs-web-mcp` 的 `types.ts` 中**提取**仅用于断言的类型，迁移到 `rs-shared`，**不引入** WebMCP 相关类型（`WebMcpToolDefinition` 等）。`rs-web-mcp` 的 `types.ts` 中保留的断言类型改为从 `@rabjs/shared` re-export：

```ts
// reactive-state/shared/src/assert/types.ts

/**
 * 断言操作符（与 rs-web-mcp 完全对齐）
 */
export type AssertOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'notExists'
  | 'includes'
  | 'notIncludes'
  | 'matches'
  | 'type'
  | 'length'
  | 'lengthGt'
  | 'lengthGte'
  | 'lengthLt'
  | 'lengthLte'
  | 'deepEq'
  | 'between'
  | 'hasKeys'
  | 'matchObject'
  | 'some'
  | 'every';

export type ScalarAssertOp = Extract<
  AssertOp,
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'notExists'
  | 'includes'
  | 'notIncludes'
  | 'matches'
  | 'type'
>;

export interface ElementAssertion {
  path: string;
  op: ScalarAssertOp;
  expected?: unknown;
}

export interface Assertion {
  path: string;
  op: AssertOp;
  expected?: unknown;
  message?: string;
}

export interface AssertionResult {
  path: string;
  op: AssertOp;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  message?: string;
  error?: string;
}

export interface AssertResult {
  /** 整组断言是否全部通过 */
  passed: boolean;
  /** 通过数 / 总数 */
  summary: { passed: number; total: number };
  /** 每条断言的详细结果 */
  results: AssertionResult[];
  /** 目标 Service 的 instanceId */
  instanceId: string;
  /** 可选：这组断言的描述 */
  description?: string;
}
```

---

## 核心 API 设计（`assert/expect.ts`）

### `RSExpectBuilder` — Fluent Chain 建造者

```ts
/**
 * 链式断言建造者
 *
 * 通过 window.__RS_ROOT_CONTAINER__.expect('instanceId') 获取
 * 或直接 import { rsExpect } from '@rabjs/devtools' 使用
 *
 * @example
 * // 控制台快速验证
 * window.__RS_ROOT_CONTAINER__
 *   .expect('CartService_abc')
 *   .toBe('items.length', 3)
 *   .toExist('currentUser')
 *   .run()
 */
export class RSExpectBuilder {
  private assertions: Assertion[] = [];
  private description?: string;

  constructor(
    private readonly instanceId: string,
    private readonly getInstance: (id: string) => Service | undefined
  ) {}

  /** 设置整组断言的描述（出现在报告中） */
  describe(desc: string): this { ... }

  // ─── 相等 ─────────────────────────────────────────────
  toBe(path: string, expected: unknown, message?: string): this
  notToBe(path: string, expected: unknown, message?: string): this

  // ─── 大小比较 ─────────────────────────────────────────
  toBeGreaterThan(path: string, expected: number, message?: string): this
  toBeGreaterThanOrEqual(path: string, expected: number, message?: string): this
  toBeLessThan(path: string, expected: number, message?: string): this
  toBeLessThanOrEqual(path: string, expected: number, message?: string): this
  toBeBetween(path: string, lo: number, hi: number, message?: string): this

  // ─── 存在性 ───────────────────────────────────────────
  toExist(path: string, message?: string): this
  toNotExist(path: string, message?: string): this

  // ─── 包含 ─────────────────────────────────────────────
  toInclude(path: string, expected: unknown, message?: string): this
  toNotInclude(path: string, expected: unknown, message?: string): this

  // ─── 正则 ─────────────────────────────────────────────
  toMatch(path: string, pattern: string, message?: string): this

  // ─── 类型 ─────────────────────────────────────────────
  toBeType(path: string, type: string, message?: string): this

  // ─── 长度 ─────────────────────────────────────────────
  toHaveLength(path: string, expected: number, message?: string): this
  toHaveLengthGt(path: string, expected: number, message?: string): this
  toHaveLengthGte(path: string, expected: number, message?: string): this
  toHaveLengthLt(path: string, expected: number, message?: string): this
  toHaveLengthLte(path: string, expected: number, message?: string): this

  // ─── 对象 ─────────────────────────────────────────────
  toHaveKeys(path: string, keys: string | string[], message?: string): this
  toMatchObject(path: string, subset: Record<string, unknown>, message?: string): this
  toDeepEqual(path: string, expected: unknown, message?: string): this

  // ─── 数组元素断言 ─────────────────────────────────────
  toHaveSome(path: string, assertion: ElementAssertion, message?: string): this
  toHaveEvery(path: string, assertion: ElementAssertion, message?: string): this

  // ─── 底层 op 直接调用 ─────────────────────────────────
  /** 直接传 op 和 expected，适合高级用户或批量构建 */
  assert(path: string, op: AssertOp, expected?: unknown, message?: string): this

  // ─── 执行 ─────────────────────────────────────────────
  /**
   * 执行所有断言，返回结构化结果
   * 不抛错，结果通过 AssertResult.passed 判断
   */
  run(): AssertResult

  /**
   * 执行所有断言，控制台输出彩色报告
   * 所有断言通过时返回 true，否则返回 false
   *
   * 等价于 run() + report()，适合控制台快速调试
   */
  check(): boolean

  /**
   * 执行断言，失败时抛出 Error（类 Jest 语义）
   * 适合 E2E 测试脚本中使用（需要强断言）
   *
   * @throws {RSAssertionError} 任意断言失败时
   */
  expect(): void
}
```

### 方法语义对照表

| RSExpectBuilder 方法              | 对应 AssertOp | Jest 对应                                               |
| --------------------------------- | ------------- | ------------------------------------------------------- |
| `toBe(path, v)`                   | `eq`          | `expect(x).toBe(v)`                                     |
| `notToBe(path, v)`                | `neq`         | `expect(x).not.toBe(v)`                                 |
| `toBeGreaterThan(path, n)`        | `gt`          | `expect(x).toBeGreaterThan(n)`                          |
| `toBeGreaterThanOrEqual(path, n)` | `gte`         | `expect(x).toBeGreaterThanOrEqual(n)`                   |
| `toBeLessThan(path, n)`           | `lt`          | `expect(x).toBeLessThan(n)`                             |
| `toBeLessThanOrEqual(path, n)`    | `lte`         | `expect(x).toBeLessThanOrEqual(n)`                      |
| `toBeBetween(path, lo, hi)`       | `between`     | —                                                       |
| `toExist(path)`                   | `exists`      | `expect(x).toBeDefined()`                               |
| `toNotExist(path)`                | `notExists`   | `expect(x).toBeUndefined()`                             |
| `toInclude(path, v)`              | `includes`    | `expect(arr).toContain(v)` / `expect(str).toContain(v)` |
| `toNotInclude(path, v)`           | `notIncludes` | `expect(arr).not.toContain(v)`                          |
| `toMatch(path, pattern)`          | `matches`     | `expect(str).toMatch(/pattern/)`                        |
| `toBeType(path, type)`            | `type`        | `expect(typeof x).toBe(type)`                           |
| `toHaveLength(path, n)`           | `length`      | `expect(arr).toHaveLength(n)`                           |
| `toHaveLengthGt(path, n)`         | `lengthGt`    | —                                                       |
| `toHaveLengthGte(path, n)`        | `lengthGte`   | —                                                       |
| `toHaveLengthLt(path, n)`         | `lengthLt`    | —                                                       |
| `toHaveLengthLte(path, n)`        | `lengthLte`   | —                                                       |
| `toHaveKeys(path, keys)`          | `hasKeys`     | `expect(obj).toHaveProperty(key)`                       |
| `toMatchObject(path, subset)`     | `matchObject` | `expect(obj).toMatchObject(subset)`                     |
| `toDeepEqual(path, v)`            | `deepEq`      | `expect(x).toEqual(v)`                                  |
| `toHaveSome(path, assertion)`     | `some`        | `expect(arr).toEqual(expect.arrayContaining(...))`      |
| `toHaveEvery(path, assertion)`    | `every`       | —                                                       |

---

## 报告输出设计（`assert/reporter.ts`）

`check()` 和 `expect()` 方法在执行断言后，会通过 `reporter.ts` 在控制台输出结构化、带颜色的报告。

### 输出格式示例

**全部通过时（简洁模式）：**

```
✅ CartService_abc [2/2] 验证购物车状态
  ✓ items.length === 3
  ✓ currentUser exists
```

**有失败时（详细模式）：**

```
❌ CartService_abc [1/2] 验证购物车状态
  ✓ items.length === 3
  ✗ currentUser.name eq "Alice"
      Expected: "Alice"
      Actual:   "Bob"
      Message:  当前用户名应为 Alice
```

### reporter API

```ts
export interface ReportOptions {
  /** 是否将 console.group 折叠，默认 false（展开） */
  collapsed?: boolean;
  /** 是否在全部通过时也打印报告，默认 true */
  verbose?: boolean;
}

export function printAssertResult(result: AssertResult, options?: ReportOptions): void;
```

---

## `RSRootContainerHandle` 接口扩展

`root-container-handle.ts` 的 `RSRootContainerHandle` 接口新增 `expect` 方法：

```ts
export interface RSRootContainerHandle {
  container: Container;
  getService(instanceId: string): Service | undefined;
  getContainer(containerName: string): Container | undefined;
  listServices(): Array<{...}>;

  /**
   * NEW：创建针对指定 Service 实例的链式断言构建器
   *
   * @param instanceId Service 实例的唯一标识符（通过 listServices() 查看）
   * @returns RSExpectBuilder 链式断言构建器
   *
   * @example
   * window.__RS_ROOT_CONTAINER__
   *   .expect('CartService_abc')
   *   .toBe('items.length', 3)
   *   .toExist('currentUser')
   *   .check()
   */
  expect(instanceId: string): RSExpectBuilder;
}
```

---

## 公开 API 导出（`src/main.ts` 更新）

```ts
// 已有导出（不变）
export type { RSRootContainerHandle } from './root-container-handle';
export { createRSRootContainerHandle } from './root-container-handle';
export { setupWindowRootContainer } from './root-container-handle';

// 新增导出
export type {
  AssertOp,
  Assertion,
  AssertionResult,
  AssertResult,
  ElementAssertion,
} from './assert/types';
export { RSExpectBuilder } from './assert/expect';
export { printAssertResult } from './assert/reporter';

/**
 * 独立使用入口：无需 window 挂载，直接传入 Service 实例断言
 *
 * 适合 E2E 测试框架、Node.js 测试环境中的手动集成
 *
 * @example
 * import { rsExpect } from '@rabjs/devtools';
 * rsExpect(cartService)
 *   .toBe('items.length', 0)
 *   .expect(); // 失败时抛 Error
 */
export { rsExpect } from './assert/expect';
```

### `rsExpect` — 独立使用入口

`rsExpect` 是一个工厂函数，直接接受 Service 实例（而非 instanceId），适合脱离 window 挂载的场景：

```ts
export function rsExpect(instance: object, description?: string): RSExpectBuilder;
```

---

## 错误类型（`assert/types.ts` 补充）

```ts
/**
 * 断言失败时由 RSExpectBuilder.expect() 抛出的错误
 * 继承 Error，包含结构化断言结果
 */
export class RSAssertionError extends Error {
  constructor(
    public readonly result: AssertResult,
    message: string
  ) {
    super(message);
    this.name = 'RSAssertionError';
  }
}
```

---

## 使用示例

### 场景 1：Chrome DevTools 控制台快速断言

```js
// 查找 Service
window.__RS_ROOT_CONTAINER__.listServices();
// => [{ instanceId: 'CartService_abc123', ... }]

// 链式断言，check() 输出控制台报告并返回 boolean
window.__RS_ROOT_CONTAINER__
  .expect('CartService_abc123')
  .describe('验证购物车初始化状态')
  .toBe('isInitialized', true)
  .toHaveLength('items', 0)
  .toExist('userId')
  .check();
// 控制台输出：
// ✅ CartService_abc123 [3/3] 验证购物车初始化状态
//   ✓ isInitialized === true
//   ✓ items.length === 0
//   ✓ userId exists
// => true
```

### 场景 2：脱离 window，直接断言 Service 实例（E2E 测试）

```ts
import { rsExpect } from '@rabjs/devtools';

// 在 E2E 测试或脱离 React 的环境中
const cartService = container.resolve(CartService);

rsExpect(cartService, '加入商品后的购物车状态')
  .toBe('items.length', 1)
  .toBe('items.0.productId', 'SKU_001')
  .toBeGreaterThan('totalPrice', 0)
  .expect(); // 失败时抛 RSAssertionError
```

### 场景 3：获取结构化报告（程序消费）

```ts
const result = window.__RS_ROOT_CONTAINER__
  .expect('ProductService_xyz')
  .toBe('loading', false)
  .toHaveLengthGt('productList', 0)
  .run(); // 返回 AssertResult，不打印、不抛错

if (!result.passed) {
  console.table(result.results);
  // 发送到监控系统等
}
```

### 场景 4：E2E 测试框架集成（Playwright / Cypress）

```ts
// playwright test
await page.evaluate(() => {
  const result = window.__RS_ROOT_CONTAINER__
    .expect('OrderService_123')
    .toBe('orderStatus', 'submitted')
    .run();

  if (!result.passed) {
    throw new Error(JSON.stringify(result.results));
  }
});
```

### 场景 5：嵌套路径 + 数组元素断言

```js
window.__RS_ROOT_CONTAINER__
  .expect('LadingService_def')
  .toBe('ladingMonitorData.list.length', 5)
  .toHaveSome('ladingMonitorData.list', {
    path: 'status',
    op: 'eq',
    expected: 'DELIVERED',
  })
  .toHaveEvery('ladingMonitorData.list', {
    path: 'waybillCode',
    op: 'exists',
  })
  .check();
```

---

## 实现细节

### `@rabjs/shared` 与现有代码的迁移策略

**`rs-web-mcp` 的迁移方式（推荐渐进式）**：

| 文件                    | 迁移方式                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `utils/resolve-path.ts` | 删除，改为 `export { resolvePath, toSafeActual } from '@rabjs/shared'`                              |
| `utils/assert.ts`       | 删除，改为 `export { executeAssertion, executeAssertions } from '@rabjs/shared'`                    |
| `types.ts` 中的断言类型 | 删除本地定义，改为 `export type { AssertOp, Assertion, AssertionResult, ... } from '@rabjs/shared'` |

迁移后 `rs-web-mcp` 的 `utils/` 目录中的 `assert.ts` 和 `resolve-path.ts` 变为**薄的 re-export 转发文件**，不破坏现有消费方的 import 路径，待下一 major 版本再清理。

**`rs-cdp-debug` 的依赖关系**：

```ts
// rs-cdp-debug/src/assert/expect.ts 中直接引用 shared
import { executeAssertions, resolvePath } from '@rabjs/shared';
import type { AssertOp, Assertion, AssertResult } from '@rabjs/shared';
```

### `RSExpectBuilder` 实现要点

1. **懒执行**：`toBe()` / `toExist()` 等方法只记录断言，不立即执行；`run()` / `check()` / `expect()` 触发执行
2. **链式返回 `this`**：所有记录方法返回 `this`，支持 `.toBe(...).toExist(...)` 链
3. **实例查找**：
   - 通过 `instanceId` 模式：构造时传入 `getInstance` 函数（由 `RSRootContainerHandle.expect()` 提供）
   - 通过直接实例模式：`rsExpect(instance)` 时，内部用 `{ instanceId: '(direct)', getInstance: () => instance }` 包装
4. **不可变性**：每次 `run()` 都基于当前 `assertions` 快照执行，不清空，允许多次调用 `run()`

### 断言操作符完整列表（与 rs-web-mcp 保持一致）

与 rs-web-mcp 的 `AssertOp` 定义完全对齐（22 个操作符），确保未来两者可以共享类型定义。

---

## 测试计划

### `@rabjs/shared` 的测试（新建包内）

**`src/__tests__/assert/resolve-path.test.ts`**

- 基本属性访问
- 嵌套路径 `a.b.c`
- 数组下标 `arr.0.field`
- 转义点 `a\\.b`
- 中间 null/undefined 不报错，返回 undefined
- 空路径返回 undefined

**`src/__tests__/assert/operators.test.ts`**

覆盖全部 22 个操作符的 pass / fail 路径，以及边界条件（类型不匹配、null、undefined 等）。原有 `rs-web-mcp` 中的 `utils/assert.test.ts` 和 `utils/resolve-path.test.ts` **迁移**至此，不重复书写。

### `@rabjs/devtools` 的测试

**`src/__tests__/assert/expect.test.ts`**

- `toBe` / `toExist` 等方法是否正确记录断言
- `run()` 返回正确 `AssertResult`
- `check()` 调用 `printAssertResult` 并返回 boolean
- `expect()` 在失败时抛 `RSAssertionError`，通过时不抛
- `rsExpect(instance)` 直接实例模式
- 链式多个断言的聚合结果
- `instanceId` 不存在时所有断言标记失败

---

## 实施步骤

```
Phase 1：新建 @rabjs/shared 包（断言内核）
```

1. 创建 `reactive-state/shared/` 目录，初始化 `package.json`（`@rabjs/shared`，零依赖）
2. 配置 `tsconfig.json`、`build.config.ts`、`jest.config.js`、`eslint.config.js`（参考 `rs-web-mcp` 同名文件）
3. 创建 `src/assert/types.ts` ← 从 `rs-web-mcp/src/types.ts` 提取断言相关类型
4. 创建 `src/assert/resolve-path.ts` ← 从 `rs-web-mcp/src/utils/resolve-path.ts` 迁移
5. 创建 `src/assert/operators.ts` ← 从 `rs-web-mcp/src/utils/assert.ts` 迁移，调整导入路径
6. 创建 `src/main.ts` ← re-export 所有公共 API
7. 迁移测试文件：将 `rs-web-mcp` 的 `utils/assert.test.ts` → `shared/src/__tests__/assert/operators.test.ts`，`utils/resolve-path.test.ts`（若有）→ `shared/src/__tests__/assert/resolve-path.test.ts`
8. 验收：`pnpm --filter @rabjs/shared test:coverage`（≥80%）+ `build`

```
Phase 2：改造 @rabjs/web-mcp（接入 rs-shared）
```

9. 在 `rs-web-mcp/package.json` 中新增 `"@rabjs/shared": "workspace:*"` 到 `dependencies`
10. 将 `utils/assert.ts` 改为薄 re-export：`export { executeAssertion, executeAssertions } from '@rabjs/shared'`
11. 将 `utils/resolve-path.ts` 改为薄 re-export：`export { resolvePath, toSafeActual } from '@rabjs/shared'`
12. 更新 `types.ts` 中的断言类型定义：删除本地声明，改为从 `@rabjs/shared` re-export
13. 验收：`pnpm --filter @rabjs/web-mcp test:coverage` 全部通过（不允许回归）

```
Phase 3：rs-cdp-debug 新增 Expect Builder + Reporter
```

14. 在 `rs-cdp-debug/package.json` 中新增 `"@rabjs/shared": "workspace:*"` 到 `dependencies`
15. 创建 `src/assert/expect.ts` ← `RSExpectBuilder` + `rsExpect` 工厂函数（引用 `@rabjs/shared`）
16. 创建 `src/assert/reporter.ts` ← 控制台彩色报告
17. 写单元测试 `src/__tests__/assert/expect.test.ts`

```
Phase 4：集成到 window 挂载 + 公开 API
```

18. 更新 `src/root-container-handle.ts` ← `RSRootContainerHandle` 接口新增 `expect()`，实现中注入
19. 更新 `src/main.ts` ← 新增断言相关类型和函数的导出

```
Phase 5：验收
```

20. `pnpm --filter @rabjs/devtools test:coverage`（≥80%）
21. `pnpm --filter @rabjs/devtools build`
22. 确认 `pnpm-workspace.yaml` 已包含 `reactive-state/shared`

---

## 风险与决策记录

### 风险 1：`@rabjs/shared` 包版本管理

`rs-shared` 作为公共依赖，`rs-web-mcp` 和 `rs-cdp-debug` 均依赖它。若 `rs-shared` 有 Breaking Change，两个包需要同步升级。

**缓解**：

- monorepo 内使用 `workspace:*`，版本天然同步；
- 为 `rs-shared` 建立独立的 changeset 流程，Breaking Change 触发 major bump 并在 changelog 中明确说明受影响的包；
- `rs-shared` 的类型和函数签名应保持保守，优先做加法（新增导出），避免修改已有 API。

### 风险 2：console 彩色输出兼容性

部分嵌入式 WebView DevTools 不支持 `%c` 彩色 console。

**缓解**：`reporter.ts` 先检测 `typeof window !== 'undefined' && window.console`；降级为普通 `console.log`，不依赖颜色代码。

### 风险 3：`expect()` 方法命名冲突

`RSRootContainerHandle.expect()` 与 Jest 全局 `expect()` 同名，可能引起混淆。

**决策**：保持 `expect(instanceId)` 命名（语义清晰："期望这个 Service 满足..."），与 Jest 的 `expect(value)` 用法一致，学习成本低。在文档中注明区别。

### 风险 4：包体积增加

增加断言模块后包体积会增加约 5-8KB（gzip 后）。

**决策**：可接受。调试工具的用途本身决定其不在生产包大小上有严格限制，且 `@rabjs/devtools` 本就是显式按需引入的调试包。
