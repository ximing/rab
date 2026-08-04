# `assert_state` 功能验证方案技术设计

## 背景与问题

### 现有 `get_state` 的局限性

现有 `get_state` Tool 设计目标是"完整序列化 Service 状态"，在真实业务 Service（如 `TMSWorkbenchService`）中会触发以下问题：

**问题一：getter 返回整个 Service 对象，被递归序列化导致 OOM**

```typescript
export class TMSWorkbenchService extends Service {
  // ❌ getter 返回 Service 实例，serializeState 读取后会递归展开
  get orderReceivingStoreService() {
    return this.resolve(OrderReceivingStoreService); // 返回 Service 对象
  }
  get poiOptions() {
    return this.orderReceivingStoreService.options;  // 派生状态
  }
}
```

`serializeState` 调用 `Object.keys(instance)` + 属性访问时，会触发 getter 返回 Service 实例，
然后 `safeSerialize` 将整个 Service 对象树递归展开，造成内存溢出，浏览器 tab crash。

**问题二：`safeSerialize` 跨属性不共享 `seen` WeakSet，循环引用检测失效**

```typescript
// 每次调用 safeSerialize 创建全新的 seen，无法检测跨属性的循环引用
result[key] = safeSerialize(value); // 每个 key 各自一个 WeakSet
```

**问题三：业务数据属性持有大型列表（分页数据），完整序列化本来就没必要**

```typescript
ladingMonitorData: LadingMonitorData | null = null;  // 可能含几百条记录
routePlanData: RoutePlanData | null = null;
```

### 真实需求重新定义

> **AI Agent 通过一系列原子 Tool 调用，对 Service 执行操作后，验证其状态是否符合预期。**

这是一个**功能验证 / 断言**场景，而非"读取并展示 Service 状态"。
核心需求是：Agent 声明"我期望某字段的值满足某条件"，框架在浏览器内执行比对，返回 pass/fail。

---

## 改造目标

1. **引入 `assert_state` Tool**：取代 `get_state` 作为状态验证的主要工具，数据不离开浏览器，彻底规避序列化 crash
2. **增强 `execute_action`**：支持 `assertAfter` 参数，在一次调用内完成"操作 + 断言"，减少 Agent 调用轮次
3. **增强 `list_services`**：区分返回 `scalarState`（基本类型字段）和 `objectState`（复杂对象字段名），供 Agent 快速了解可断言的 path
4. **`get_state` 降级**：限制为只返回标量字段，不再递归序列化对象/数组

---

## 整体调用流程

```
┌─────────────────────────────────────────────────────────────┐
│  AI Agent                                                    │
│                                                              │
│  1. [可选] list_services()                                   │
│     → 了解 scalarState / objectState / actions               │
│                                                              │
│  2. execute_action({                                         │
│       instanceId, action, args,                              │
│       assertAfter: [断言列表]     ← 操作+断言 合并为 1 次     │
│     })                                                       │
│                                                              │
│  3. assert_state({                                           │
│       instanceId,                                            │
│       assertions: [断言列表]      ← 批量断言，一次返回完整报告│
│     })                                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ 断言在浏览器内执行，只传出标量结果
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  @osgfe/rs-web-mcp                                           │
│                                                              │
│  resolvePath(instance, "ladingMonitorData.list.length")      │
│    → instance.ladingMonitorData → .list → .length            │
│    → 只取末端标量值，中间节点不序列化                          │
│                                                              │
│  executeAssertion({ op: 'gte', expected: 0, actual: 8 })     │
│    → { passed: true, actual: 8 }                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 新 Tool 设计

### Tool: `assert_state`

#### 输入

```typescript
interface AssertStateInput {
  /** Service 实例的唯一标识符，通过 list_services 获取 */
  instanceId: string;

  /** 断言列表，一次调用支持多个断言 */
  assertions: Assertion[];

  /** 可选：整组断言的描述，出现在报告中 */
  description?: string;
}

interface Assertion {
  /**
   * 点分路径，支持数组下标：
   *   "isInitialized"
   *   "ladingMonitorData.list.length"
   *   "ladingMonitorData.list[0].status"
   *   "selectedTemperature.length"
   *   "assetsReturnWhPagingMap.trunklineWaitAssignPaging.offset"
   */
  path: string;

  /** 断言操作符 */
  op: AssertOp;

  /**
   * 期望值。
   * op 为 exists / notExists 时不需要传。
   * op 为 type 时传 TypeScript typeof 字符串，如 "string"、"number"。
   * op 为 matches 时传正则字符串，如 "^route-"。
   */
  expected?: unknown;

  /** 可选：这条断言的说明，出现在失败报告里 */
  message?: string;
}

type AssertOp =
  // ─── 相等 ───────────────────────────────────────
  | 'eq'           // actual === expected
  | 'neq'          // actual !== expected
  // ─── 大小比较（数值）────────────────────────────
  | 'gt'           // actual > expected
  | 'gte'          // actual >= expected
  | 'lt'           // actual < expected
  | 'lte'          // actual <= expected
  // ─── 存在性 ─────────────────────────────────────
  | 'exists'       // actual != null && actual !== undefined
  | 'notExists'    // actual == null || actual === undefined
  // ─── 字符串 / 数组包含 ──────────────────────────
  | 'includes'     // Array.includes(expected) 或 string.includes(expected)
  | 'notIncludes'
  // ─── 正则匹配 ────────────────────────────────────
  | 'matches'      // new RegExp(expected).test(actual)
  // ─── 类型检查 ────────────────────────────────────
  | 'type'         // typeof actual === expected
  // ─── 长度断言（数组 / 字符串） ────────────────────
  | 'length'       // actual.length === expected
  | 'lengthGt'     // actual.length > expected
  | 'lengthGte'    // actual.length >= expected
  | 'lengthLt'     // actual.length < expected
  | 'lengthLte'    // actual.length <= expected
  // ─── 深比对（仅用于已知小对象） ──────────────────
  | 'deepEq';      // JSON.stringify(actual) === JSON.stringify(expected)
```

#### 输出

```typescript
interface AssertStateResult {
  /** 所有断言是否全部通过 */
  passed: boolean;

  /** 通过数 / 总数 */
  summary: {
    passed: number;
    total: number;
  };

  /** 每条断言的详细结果 */
  results: AssertionResult[];
}

interface AssertionResult {
  path: string;
  op: AssertOp;
  expected: unknown;

  /**
   * 实际读取到的值的安全摘要。
   * - 基本类型（string/number/boolean/null/undefined）：直接返回原始值
   * - Array：返回 "[Array(N)]"（N 为长度）
   * - Object：返回 "[Object]"
   * - length 类操作符：返回 length 的数字值（不暴露原始数组/字符串）
   * - exists / notExists：返回 true/false（不暴露原始值）
   * 注意：deepEq 操作符例外，会直接返回实际对象（调用方需自行承担序列化风险）
   */
  actual: unknown;

  passed: boolean;

  /** 可选：这条断言的说明（来自 Assertion.message） */
  message?: string;

  /** 断言失败时的原因描述，格式：`Expected [path] to [op] [expected], but got [actual]` */
  error?: string;
}
```

#### 关键实现原则：「操作在浏览器内，传出去的只有断言结果」

所有比对运算在浏览器 JS 引擎内部完成，通过 `resolvePath` 只提取路径末端的值参与计算，
中间节点的大对象不传输、不序列化。传出给 Agent 的只有 `passed`、标量 `actual`（或摘要字符串）。

```
resolvePath(instance, "ladingMonitorData.list.length")
  → dot-prop 内部分解为 ["ladingMonitorData", "list", "length"]
  step 1: instance["ladingMonitorData"]  → LadingMonitorData 对象（不序列化，继续走）
  step 2: .list                          → Array（不序列化，继续走）
  step 3: .length                        → 8（数字，终止，参与断言计算）

resolvePath(instance, "ladingMonitorData.list.0.status")
  → dot-prop 内部分解为 ["ladingMonitorData", "list", "0", "status"]
  step 1: instance["ladingMonitorData"]  → LadingMonitorData 对象
  step 2: .list                          → Array
  step 3: [0]（数字 key）                → 第一个元素对象
  step 4: .status                        → "loading"（字符串，终止）
```

---

### `execute_action` 增强：`assertAfter`

在现有 `execute_action` 输入中增加可选的 `assertAfter` 字段，
执行方法后立即运行断言，结果一并返回。**这将大多数「操作+验证」从 2 次调用压缩到 1 次。**

#### 增强后的输入

```typescript
interface ExecuteActionInput {
  instanceId: string;
  action: string;
  args: unknown[];

  /**
   * 可选：执行方法后立即运行的断言列表。
   * 语义等同于执行完 execute_action 后立即调用 assert_state。
   * 当方法为异步时，等待 Promise resolve 后再执行断言。
   */
  assertAfter?: Assertion[];
}
```

#### 增强后的输出

```typescript
interface ExecuteActionResult {
  result: unknown;
  loading: boolean;
  error: string | null;

  /**
   * assertAfter 的执行结果。
   * 仅当输入中传了 assertAfter 时存在。
   * 若方法本身执行报错（error != null），断言仍会执行（基于报错后的状态）。
   */
  assertion?: AssertStateResult;
}
```

---

### `list_services` 增强：`scalarState` / `objectState`

在 `list_services` 返回的每个 Service 信息中，将 `stateKeys` 细化为两类：

```typescript
interface ServiceInfo {
  instanceId: string;
  containerName: string;
  identifierType: string;
  identifierLabel: string;
  scope: string;
  actions: ActionInfo[];

  // 原 stateKeys 拆分为两个字段：

  /**
   * 基本类型（string/number/boolean/null）的字段及其当前类型。
   * Agent 可直接对这些字段使用 eq / gt / exists 等操作符。
   */
  scalarState: Record<string, 'string' | 'number' | 'boolean' | 'null'>;

  /**
   * 复杂类型（object/array）字段的名称列表（不展开内容）。
   * Agent 可通过点分路径深入这些字段的子属性进行断言，
   * 如 "ladingMonitorData.list.length"。
   */
  objectState: string[];
}
```

**示例输出（TMSWorkbenchService）**：

```json
{
  "instanceId": "TMSWorkbenchService#0",
  "scalarState": {
    "isInitialized": "boolean",
    "isInitializing": "boolean",
    "isFiltersReady": "boolean",
    "activeStep": "string",
    "selectedDate": "number",
    "offset": "number",
    "limit": "number",
    "listOrder": "number",
    "selectedDeliveryTag": "null"
  },
  "objectState": [
    "ladingMonitorData",
    "arriveStoreData",
    "workProgressData",
    "scheduleTodoStatistic",
    "indicatorsData",
    "transportExecuteStatisticData",
    "routePlanData",
    "inTransitData",
    "arriveStoreWaybillDetailData",
    "assetsReturnWhData",
    "assetsReturnWhPagingMap",
    "selectedTemperature",
    "inStorePaging",
    "congestionPaging"
  ]
}
```

Agent 拿到 `scalarState` 后可直接写 `eq` 断言，拿到 `objectState` 后知道哪些字段可以用点分路径深入。

---

### `get_state` 降级

`get_state` 改为**只返回标量字段的当前值**，不再序列化对象/数组，彻底规避 crash 风险。
复杂对象字段改为只返回类型摘要。

```typescript
// 降级后的 get_state 输出示例
{
  "state": {
    "isInitialized": true,
    "activeStep": "route-plan",
    "selectedDate": 1748304000000,
    "offset": 0,
    "ladingMonitorData": "[Object]",      // 不序列化，只告知存在且为对象
    "selectedTemperature": "[Array(0)]",  // 不序列化，只告知是数组及长度
    "selectedDeliveryTag": null
  },
  "model": {
    "queryLadingMonitor": { "loading": false, "error": null },
    "initialize": { "loading": false, "error": null }
  }
}
```

对于需要深入验证对象内部的场景，使用 `assert_state` + 点分路径代替。

---

## Tool 调用最佳实践

### 场景一：验证初始化完成后的状态（2 次调用）

```json
// 调用 1：触发初始化，同时断言基础状态
{
  "tool": "execute_action",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "action": "initialize",
    "args": [],
    "assertAfter": [
      { "path": "isInitialized", "op": "eq", "expected": true },
      { "path": "isInitializing", "op": "eq", "expected": false },
      { "path": "isFiltersReady", "op": "eq", "expected": false }
    ]
  }
}
// → { result: undefined, error: null, assertion: { passed: true, ... } }

// 调用 2：验证数据加载结果（多条断言，一次返回）
{
  "tool": "assert_state",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "description": "初始化后工作台数据应已加载",
    "assertions": [
      { "path": "ladingMonitorData", "op": "exists", "message": "运单监控数据应已加载" },
      { "path": "routePlanData", "op": "exists", "message": "排线计划数据应已加载" },
      { "path": "indicatorsData", "op": "exists", "message": "指标数据应已加载" },
      { "path": "ladingMonitorData.list.length", "op": "gte", "expected": 0 },
      { "path": "activeStep", "op": "eq", "expected": "route-plan" }
    ]
  }
}
// → { passed: true, summary: { passed: 5, total: 5 }, results: [...] }
```

### 场景二：验证分页操作（1 次调用）

```json
{
  "tool": "execute_action",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "action": "setPagination",
    "args": [10, 20],
    "assertAfter": [
      { "path": "offset", "op": "eq", "expected": 10 },
      { "path": "limit", "op": "eq", "expected": 20 },
      { "path": "ladingMonitorData.list.length", "op": "lte", "expected": 20 }
    ]
  }
}
```

### 场景三：验证筛选条件变更后的状态（1 次调用）

```json
{
  "tool": "execute_action",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "action": "setActiveStep",
    "args": ["loading"],
    "assertAfter": [
      { "path": "activeStep", "op": "eq", "expected": "loading" },
      { "path": "isFiltersReady", "op": "eq", "expected": true }
    ]
  }
}
```

### 场景四：断言失败时的报告格式

```json
{
  "passed": false,
  "summary": { "passed": 3, "total": 4 },
  "results": [
    { "path": "isInitialized", "op": "eq", "expected": true, "actual": true, "passed": true },
    { "path": "activeStep", "op": "eq", "expected": "loading", "actual": "route-plan", "passed": false,
      "error": "Expected activeStep to eq \"loading\", but got \"route-plan\"" },
    { "path": "ladingMonitorData", "op": "exists", "actual": true, "passed": true },
    { "path": "ladingMonitorData.list.length", "op": "gte", "expected": 1, "actual": 0, "passed": false,
      "message": "运单列表不应为空",
      "error": "Expected ladingMonitorData.list.length to gte 1, but got 0" }
  ]
}
```

---

## `resolvePath` 路径语法规范与库选型

### 路径语法规范

路径采用 **`dot-prop` 兼容语法**，支持以下形式：

| 语法 | 含义 | 示例 |
|------|------|------|
| `field` | 顶层直接属性 | `isInitialized` |
| `a.b.c` | 嵌套属性（点分） | `ladingMonitorData.list.length` |
| `arr.0` | 数组下标（`.数字` 形式） | `ladingMonitorData.list.0.status` |
| `arr.0.field` | 下标 + 属性 | `ladingMonitorData.list.0.waybillCode` |
| `obj.key with space` | 含空格的 key（`\\.` 转义点） | 少见，暂不支持 |

> **说明**：数组下标统一使用 `.数字` 语法（`list.0`），而非 `[0]` 方括号语法。
> 这是 `dot-prop` 的标准形式，工具链一致、实现简单、无歧义。

#### 完整路径示例（对应 TMSWorkbenchService）

```
isInitialized                                    → true / false
activeStep                                       → "route-plan"
selectedDate                                     → 1748304000000
selectedTemperature.length                       → 0
ladingMonitorData                                → null / [Object]
ladingMonitorData.list.length                    → 8
ladingMonitorData.list.0.waybillCode             → "WB20240527001"
ladingMonitorData.list.0.status                  → "loading"
assetsReturnWhPagingMap.trunklineWaitAssignPaging.offset  → 0
assetsReturnWhPagingMap.trunklineWaitAssignPaging.limit   → 10
inStorePaging.offset                             → 0
routePlanData.list.length                        → 5
routePlanData.statistic.containerNotFullLoadWaybillCount  → 3
```

---

### 开源库选型

#### 候选库对比

| 库 | 版本 | 周下载量 | 体积（min+gz） | 零依赖 | ESM | 数组下标语法 | 特点 |
|---|---|---|---|---|---|---|---|
| **`dot-prop`** | 10.x | ~3000万/周 | ~1.5 KB | ✅（依赖 type-fest，纯 TS 类型） | ✅ | `.0`（点数字） | 最流行、TypeScript 原生、ESM-only |
| **`object-path`** | 0.11.x | ~1200万/周 | ~2 KB | ✅ | ❌（CJS） | `.0` / `[0]` 均支持 | 支持 `[0]` 方括号；有 `coerceNumbers` 选项；CJS-only |
| **`lodash.get`** | 4.x | ~5000万/周 | ~4 KB | ✅ | ❌（CJS） | `[0]` / `.0` 均支持 | 最广泛；但体积偏大；CJS-only；lodash 整体维护减缓 |
| **`dlv`** | 1.x | ~200万/周 | **0.3 KB** | ✅ | ✅ | `.0` | 极简实现（15行）；只支持 get；无方括号语法 |
| **`just-safe-get`** | 4.x | ~50万/周 | ~0.5 KB | ✅ | ✅ | `.0` | just 工具集成员；极简 |

#### 选型结论：使用 `dot-prop`

**推荐 `dot-prop@10.x`**，理由：

1. **零运行时依赖**：`type-fest` 是纯 TS 类型包，不产生运行时代码，等同于零依赖
2. **ESM 原生**：与本包 `"type": "module"` 完全一致，无需额外转换
3. **TypeScript 原生**：完整泛型支持，`getProperty<T>(obj, path)` 类型安全
4. **最流行**：生态最成熟，社区验证充分，Bug 少
5. **API 简洁**：`getProperty(obj, path)` 返回 `undefined`（路径不存在时），无异常抛出
6. **体积合理**：1.5 KB，对于 web-mcp 包的定位完全可接受

`lodash.get` 虽然更广泛，但 CJS-only 且体积偏大，在 ESM 项目中需要额外处理；  
`dlv` 体积最小但功能过于简单，且数组下标支持不完整；  
`object-path` 支持 `[0]` 方括号，但 CJS-only，不推荐。

#### 安装

```bash
pnpm add dot-prop
```

#### 在 `resolvePath` 中的使用方式

```typescript
import { getProperty } from 'dot-prop';

/**
 * 从 Service 实例按路径读取末端值
 * 路径语法遵循 dot-prop 规范：点分路径 + .数字 下标
 *
 * @example
 *   resolvePath(instance, "ladingMonitorData.list.0.status")
 *   resolvePath(instance, "selectedTemperature.length")
 */
export function resolvePath(instance: object, path: string): unknown {
  return getProperty(instance, path);
  // 中间节点为 null/undefined 时 dot-prop 返回 undefined，不抛错
  // 不做任何序列化，直接返回末端原始值
}
```

`dot-prop` 的安全语义：
- 中间节点为 `null` / `undefined` → 返回 `undefined`，不抛错
- 路径不存在 → 返回 `undefined`
- 只做属性访问，不调用 getter 以外的任何函数（getter 正常触发）

---

## `actual` 值的安全摘要规则

所有从 Service 取出的值，在传给 Agent 前按以下规则转为"安全摘要"：

| 实际类型 | 安全摘要 | 说明 |
|---------|---------|------|
| `string` / `number` / `boolean` / `null` / `undefined` | 原值 | 基本类型直接传出 |
| `Array` | `"[Array(N)]"` | N 为数组长度 |
| `object`（非 null） | `"[Object]"` | 不展开 |
| `function` | `"[Function]"` | 不暴露 |

**例外**：`length` / `lengthGt` 等长度操作符，`actual` 返回的是 `.length` 的数字值（而非数组摘要），
因为操作符本身只关心长度，且数字可安全传输。

**例外**：`exists` / `notExists` 操作符，`actual` 返回 `true` / `false`，不暴露原始值。

---

## 文件结构变更

```diff
 reactive-state/web-mcp/src/
 ├── main.ts
 ├── decorator.ts
 ├── bridge.ts
 ├── registry.ts
 ├── tools/
 │   ├── list-services.ts     # 增强：新增 scalarState / objectState 分类
 │   ├── execute-action.ts    # 增强：新增可选 assertAfter 参数
 │   ├── get-state.ts         # 降级：只返回标量字段和对象摘要
+│   └── assert-state.ts      # 新增：assert_state Tool 实现
 ├── utils/
 │   ├── identifier.ts
 │   ├── serialize.ts         # 保持不变（降级后的 get_state 仍用它）
+│   ├── resolve-path.ts      # 新增：点分路径解析工具（封装 dot-prop，统一安全语义）
+│   ├── assert.ts            # 新增：断言操作符执行逻辑
 │   ├── schema.ts
 │   └── reflect.ts
 └── types.ts                 # 新增 Assertion / AssertOp / AssertStateInput / AssertStateResult 类型
```

---

## 关键设计决策

| 决策点 | 方案 | 原因 |
|--------|------|------|
| 断言在哪里执行 | **浏览器内部执行**，只传出标量结果 | 彻底规避大对象序列化 crash；数据安全 |
| `actual` 值的处理 | 基本类型原样返回，对象/数组返回摘要字符串 | Agent 看到 `"[Object]"` 知道字段存在，但不会触发反序列化 |
| 路径语法 | **`dot-prop` 语法**：`.` 分隔 + `.数字` 下标（`list.0`） | 统一、无歧义；放弃 `[0]` 方括号语法，避免双重解析逻辑 |
| 路径解析库 | **`dot-prop@10.x`** | ESM 原生、零运行时依赖（type-fest 纯类型）、TypeScript 原生、最流行（3000万周下载） |
| `assertAfter` 合并 | 在 `execute_action` 内部完成 | 减少 Agent 调用轮次；异步方法 await 后再断言，避免竞态 |
| `list_services` 分类 | `scalarState` 与 `objectState` 分开 | Agent 可以快速知道哪些字段可以直接 `eq`，哪些需要用点分路径深入 |
| `get_state` 保留但降级 | 保留，仅返回标量和摘要 | 向下兼容；仍适合初步探索 Service 状态的场景 |
| 断言结果格式 | `passed` + `summary` + `results[]` | 一次调用多断言；失败时提供差异报告，Agent 无需逐条解析 |
| `deepEq` 操作符 | 保留，但文档标注"仅用于已知小对象" | 提供逃生门，不强制限制；由 Agent 自行承担风险 |
