# `assert_state` 断言操作符扩展方案

## 背景

现有 `assert_state` Tool 已支持 17 种操作符（`eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`exists`/`notExists`/`includes`/`notIncludes`/`matches`/`type`/`length`/`lengthGt`/`lengthGte`/`lengthLt`/`lengthLte`/`deepEq`），覆盖了基础的标量断言场景。

但 AI Agent 在验证业务 Service 状态时，经常面临无法被已有操作符优雅表达的场景：

- 验证数字在某个**区间范围**内（`between`）
- 验证对象**包含指定 key**（`hasKeys`）
- 验证对象**局部键值**符合预期（`matchObject`）
- 验证数组中**某个/所有元素满足条件**（`some`/`every`）

---

## 设计原则

> **不变量**：无论新增任何操作符，传出给 Agent 的 `actual` 永远是标量或安全摘要，不传出大对象。

| 原则            | 说明                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| 浏览器内执行    | 所有比对逻辑在 JS 引擎内完成，不序列化中间节点                             |
| `actual` 安全   | 对象/数组只传出摘要（`"[Object]"`/`"[Array(N)]"`），不暴露内部数据         |
| 原子操作        | 每条断言针对一个 `path` 一个 `op`，不引入嵌套结构                          |
| 向后兼容        | 新增 `op` 不影响已有断言的行为                                             |
| TypeScript 穷举 | `AssertOp` union 类型扩展后，`switch` 的 `default: never` 编译期保障无遗漏 |

---

## 新增操作符清单（5 个）

> **选取原则**：只保留高频且无简单替代方案的操作符。

### `between` — 数值区间（闭区间）

| 语义                                   | expected 类型      | actual 摘要 |
| -------------------------------------- | ------------------ | ----------- |
| `expected[0] <= actual <= expected[1]` | `[number, number]` | 原始数值    |

开区间场景极少，用 `gt + lt` 两条断言替代，不引入 `betweenExclusive`。

```json
{ "path": "offset", "op": "between", "expected": [0, 1000] }
{ "path": "limit",  "op": "between", "expected": [10, 100] }
```

---

### `hasKeys` — 对象 key 检查

| 语义                 | expected 类型        | actual 摘要  |
| -------------------- | -------------------- | ------------ |
| 对象包含所有指定 key | `string \| string[]` | `"[Object]"` |

支持单个 `string` 或 `string[]`，合并了原设计中 `hasKey`/`hasKeys` 两个操作符，AI 调用时无需区分。

验证字段不存在用 `resolvePath` + `notExists` 替代，不引入 `notHasKey`。

```json
{ "path": "ladingMonitorData", "op": "hasKeys", "expected": "list" }
{ "path": "pagination", "op": "hasKeys", "expected": ["offset", "limit", "total"] }
```

---

### `matchObject` — 对象结构浅层匹配

| 语义                                             | expected 类型              | actual 摘要  |
| ------------------------------------------------ | -------------------------- | ------------ |
| 对象包含 expected 的所有键值对（允许有多余字段） | `object`（值仅含基本类型） | `"[Object]"` |

只做**浅层** `===` 比较，expected 的值只能为基本类型（string/number/boolean/null），不支持嵌套对象。深层验证用 `resolvePath` + 多条标量断言替代。

```json
{ "path": "inStorePaging", "op": "matchObject", "expected": { "offset": 0, "limit": 10 } }
```

---

### `some` / `every` — 数组元素断言

| 操作符  | 语义                                     | expected 类型      | actual 摘要    |
| ------- | ---------------------------------------- | ------------------ | -------------- |
| `some`  | 数组至少一个元素的指定子路径满足标量断言 | `ElementAssertion` | `"[Array(N)]"` |
| `every` | 数组每个元素的指定子路径满足标量断言     | `ElementAssertion` | `"[Array(N)]"` |

`every` 在数组为空时返回 `false`（防止空数组意外通过）。

`ElementAssertion.op` 只允许标量操作符（`ScalarAssertOp`），不允许嵌套 `some`/`every`，防止递归。

```json
// 数组每个元素的 status 字段均存在
{ "path": "ladingMonitorData.list", "op": "every", "expected": { "path": "status", "op": "exists" } }

// 数组至少一个元素的 status 为 "loading"
{ "path": "ladingMonitorData.list", "op": "some", "expected": { "path": "status", "op": "eq", "expected": "loading" } }
```

---

## 未纳入的操作符及原因

| 操作符                    | 原因                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `startsWith` / `endsWith` | 现有 `matches` 支持正则（`^prefix` / `suffix$`）可完全替代；调用频率低，不值得专门一个 op |
| `hasKey`（单独）          | 合并进 `hasKeys`，`expected` 支持 `string \| string[]`，无需两个操作符                    |
| `arrayContaining`         | 验证多个标量元素同时包含的场景极少；拆成多条 `includes` 即可                              |
| `containsObject`          | `some` + 子断言可完全替代；避免引入功能重叠的操作符                                       |
| `betweenExclusive`        | 开区间场景极少；`gt + lt` 两条断言即可替代                                                |
| `notHasKey`               | 场景极少；`resolvePath` + `notExists` 可替代                                              |
| `unique`                  | AI Agent 几乎不需要主动断言数组唯一性，属于过度设计                                       |

---

## 类型定义变更

### `AssertOp` 扩展

```typescript
export type AssertOp =
  // ─── 现有操作符（保持不变）────────────────────────
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
  // ─── 新增 ─────────────────────────────────────────
  | 'between' // expected[0] <= actual <= expected[1]
  | 'hasKeys' // 对象包含指定 key（string 或 string[]）
  | 'matchObject' // 对象包含 expected 的所有键值对（浅层）
  | 'some' // arr.some(item => subPath satisfies subOp)
  | 'every'; // arr.every(item => subPath satisfies subOp)
```

### `ScalarAssertOp` 与 `ElementAssertion`（新增）

```typescript
/** every/some 中允许使用的操作符（防止嵌套递归） */
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

/** every/some 的 expected 结构：针对数组元素子路径的标量断言 */
export interface ElementAssertion {
  path: string; // 相对于数组元素的子路径
  op: ScalarAssertOp; // 标量操作符
  expected?: unknown; // 期望值
}
```

---

## 实现位置

所有新操作符在现有 `src/utils/assert.ts` 的 `switch` 语句中追加 `case`，不新增文件。

新增辅助函数（同在 `assert.ts` 中）：

- `isSubset(subset, target)` — 浅层子集检查，用于 `matchObject`
- `executeScalarAssertion(item, assertion)` — 标量子断言执行，用于 `some`/`every`

---

## 典型使用示例

```json
// 场景一：验证分页区间合理
{
  "tool": "assert_state",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "assertions": [
      { "path": "offset", "op": "between", "expected": [0, 1000] },
      { "path": "limit",  "op": "between", "expected": [10, 100] }
    ]
  }
}

// 场景二：验证列表非空且所有运单状态已填充
{
  "tool": "assert_state",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "assertions": [
      { "path": "ladingMonitorData.list", "op": "lengthGte", "expected": 1, "message": "列表不为空" },
      {
        "path": "ladingMonitorData.list",
        "op": "every",
        "expected": { "path": "status", "op": "exists" },
        "message": "每条运单均有 status 字段"
      }
    ]
  }
}

// 场景三：验证分页对象结构完整
{
  "tool": "assert_state",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "assertions": [
      { "path": "inStorePaging", "op": "hasKeys", "expected": ["offset", "limit", "total"] },
      { "path": "inStorePaging", "op": "matchObject", "expected": { "offset": 0, "limit": 20 } }
    ]
  }
}

// 场景四：验证路由跳转后 activeStep 以特定字符串开头（用 matches 替代 startsWith）
{
  "tool": "execute_action",
  "input": {
    "instanceId": "TMSWorkbenchService#0",
    "action": "setActiveStep",
    "args": ["route-plan"],
    "assertAfter": [
      { "path": "activeStep", "op": "matches", "expected": "^route" }
    ]
  }
}
```

---

## 关键决策记录

| 决策                           | 方案                                              | 原因                                                                    |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `every`/`some` 的嵌套防护      | 引入 `ScalarAssertOp` 子集类型，运行时过滤非法 op | 防止 `every → every → ...` 递归导致性能问题或 OOM                       |
| `matchObject` 仅做浅层比对     | expected 的值只允许基本类型                       | 深层对象验证应拆分为多条 `resolvePath` + 标量断言，避免大 expected 传入 |
| `between` 仅支持闭区间         | 不提供 `betweenExclusive`                         | 开区间场景极少，`gt + lt` 两条断言即可替代                              |
| `hasKeys` 合并单/多 key        | `expected` 支持 `string \| string[]`              | AI 调用时无需区分 `hasKey`/`hasKeys`，减少操作符数量                    |
| 不引入 `startsWith`/`endsWith` | 复用现有 `matches`                                | 现有 `matches` 支持正则，`^prefix`/`suffix$` 可替代，不值得专门 op      |
| 不引入 `containsObject`        | 复用 `some` + 子断言                              | `some` 已能表达相同语义，避免功能重叠                                   |
| 不引入 `arrayContaining`       | 拆成多条 `includes`                               | 高频需求极少，单条 `includes` 拆分即可满足                              |
