# @osgfe/rs-web-mcp 技术方案

## 背景

将 `@osgfe/rs-service` 的 Service 系统与 [WebMCP](http://docs.mcp-b.ai) 协议桥接，使 AI Agent 能够通过标准 MCP 接口与业务 Service 交互。

WebMCP 是 W3C 提案的浏览器原生 AI 工具注册协议，通过 `navigator.modelContext.registerTool()` 向 AI Agent 暴露能力。

---

## 改造目标

1. **通用能力**：提供三个内置 Tool（`list_services` / `execute_action` / `get_state`），让 AI Agent 无需任何业务配置即可发现和操作页面中的所有 Service
2. **业务增强**：支持通过 `@mcpTool` 装饰器将指定方法单独注册为独立 Tool，提供精准的描述和参数 Schema，提升 AI 的调用准确性
3. **零侵入**：业务代码无需任何改造，使用 `@osgfe/rs-react` 的项目只需在应用入口初始化一次，所有 `bindServices` 创建的 Container 自动纳入 MCP 管理
4. **自动感知生命周期**：Container 随组件挂载/卸载，`McpRegistry` 基于 Container 树实时遍历，无需手动注册/注销
5. **平台无关**：`rs-web-mcp` 只依赖 `@osgfe/rs-service`，不绑定 `rs-react`，同一套架构可复用到 `native-mcp` 等其他 MCP 平台
6. **类型友好**：Schema 按 `Zod > params > 可选 emitDecoratorMetadata > {}` 推断，优先复用业务已有描述；metadata 推断为显式开启能力

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     业务代码                                  │
│  class ProductService extends Service {                      │
│    @mcpTool({ description: '获取商品列表' })                  │
│    getProducts(page: number) { ... }                         │
│  }                                                           │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│              @osgfe/rs-web-mcp (本包)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  McpBridge                                           │   │
│  │  - mount(container)  绑定到某个 Container             │   │
│  │  - unmount()         解除绑定                         │   │
│  │  - 自动注册 3 个通用 Tools + 业务 @mcpTool Tools      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  @mcpTool(options) 装饰器                             │   │
│  │  - 在 Method 上标记元数据                              │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│           navigator.modelContext (WebMCP)                    │
│  - list_services       列出所有服务                           │
│  - execute_action      执行某个 Service 方法                  │
│  - get_state           获取某个 Service 状态                  │
│  - [业务自定义 Tool]   直接注册为独立 Tool                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Identity 说明

### `instanceId`：Service 实例的唯一标识

`@osgfe/rs-service` 的 `Container` 在实例化每个 Service 时，会自动为其回写 `instanceId` 属性。这是 `Service` 基类上的一个公开字段，不限于 MCP 场景，可用于日志、调试、DevTools 等任意需要追踪实例的场景。

**生成规则**（`Container.instantiate()` 负责）：

```typescript
// identifierLabel 由 ServiceIdentifier 派生：
// - Constructor → 类名，如 "CartService"
// - string      → 原样，如 "cartService"
// - symbol      → "Symbol(description)" 或 "Symbol()"

instance.instanceId = `${getIdentifierLabel(definition.identifier)}#${instanceCounter++}`;
```

| 注册方式 | 生成的 instanceId |
|---|---|
| `register(CartService)` | `CartService#0` |
| `register('cartService', CartService)` | `cartService#1` |
| `register(Symbol('payment'), PaymentService)` | `Symbol(payment)#2` |
| 另一个容器中再次注册同一个 `CartService` | `CartService#3` |

**关键性质**：
- 全局自增序号保证绝对唯一，即使两个容器注册了相同名字的 Service 也不会冲突
- 前缀保留 identifier 语义，一眼可读
- 在实例构造完成后立即赋值，整个实例生命周期内不变
- Singleton 只实例化一次，`instanceId` 永不改变；Transient 每次 `resolve()` 创建新实例，得到新 `instanceId`

**`Service` 基类定义**（`@osgfe/rs-service`）：

```typescript
export class Service {
  /**
   * 服务实例的唯一标识符
   * 格式：`{identifierLabel}#{全局自增序号}`，例如 `CartService#0`、`Symbol(payment)#3`
   * 由 Container 在实例化完成后回写，可用于日志、调试、MCP 路由等场景
   */
  public instanceId: string = '';

  // ...
}
```

### MCP 路由机制

`ServiceIdentifier` 本身（`Constructor` 引用、`symbol` 引用）无法序列化后传给 AI 再反查，`instanceId` 正好解决了这个问题：

```
遍历 Container 树
  → 只看 definition.instance 存在（已实例化）的 Service
  → 收集 instance.instanceId
  → MCP 内部维护 Map<instanceId, ServiceInstance>

AI Agent 侧：
  list_services → 获得每个实例的 instanceId
  execute_action({ instanceId: 'CartService#0', action: '...', args: [...] })
  get_state({ instanceId: 'CartService#0' })
  → MCP 内部：instanceMap.get('CartService#0') → 直接拿到实例，执行方法
```

**`identifierLabel` / `identifierType`** 仍保留在 `list_services` 的返回结果中，作为辅助展示字段，不参与路由。

---

## 三个通用 Tools 设计

### `list_services` 的扫描原则

`list_services` **只返回已实例化的 Service**——遍历 Container 树时，`definition.instance` 为空的条目直接跳过。

这意味着：
- 还没有被任何组件 `useService()` 的 Service 不出现在列表里（符合直觉）
- Transient Service 永远不出现（不缓存实例）
- 无需在发现阶段触发任何实例化副作用

### Tool 1: `list_services`

```
输入: 无

输出: {
  services: [
    {
      instanceId: "CartService#0",       // 路由主键，后续所有调用使用它
      containerName: "app",              // 所属容器名（展示用）
      identifierType: "constructor",     // "constructor" | "string" | "symbol"（展示用）
      identifierLabel: "CartService",    // identifier 的文本形式（展示用）
      scope: "singleton",
      actions: [
        {
          name: "addItem",
          description: "添加商品到购物车",
          hasMcpTool: true,
          inputSchema: { ... }
        }
      ],
      stateKeys: ["items", "total"]
    }
  ]
}
```

### Tool 2: `execute_action`

```
输入: {
  instanceId: string,   // list_services 返回的 instanceId
  action: string,       // 方法名
  args: any[]           // 方法参数数组（顺序与方法签名一致）
}

输出: {
  result: any,
  loading: boolean,
  error: string | null
}
```

### Tool 3: `get_state`

```
输入: {
  instanceId: string,   // list_services 返回的 instanceId
  keys?: string[]       // 可选，指定要读取的属性名，不传则返回全部
}

输出: {
  state: Record<string, any>,
  model: Record<string, {
    loading: boolean,
    error: string | null
  }>
}
```

---

## Schema 推断策略

WebMCP 要求每个 Tool 提供 JSON Schema 描述入参，为避免业务重复写类型，按以下优先级自动推断：

### 优先级（高 → 低）

```
1. @mcpTool({ inputSchema: z.object({...}) })   手动传 Zod Schema（最高优先级，最精确）
2. @mcpTool({ params: { ... } })                简化参数描述对象（快速书写）
3. TypeScript emitDecoratorMetadata             显式开启后的兜底推断（非默认能力）
4. 降级为 {}（无约束）                           兜底，仍可调用但 AI 无类型提示
```

### 方案一：Zod Tuple（推荐，精确控制）

用 `z.tuple([...])` 描述位置参数，语义与 `Function.apply(instance, args)` 完全一致：

```typescript
import { z } from 'zod';

class CartService extends Service {
  @mcpTool({
    description: '添加商品到购物车',
    inputSchema: z.tuple([
      z.string().describe('商品 ID'),           // args[0] → productId
      z.number().int().min(1).default(1).describe('数量'), // args[1] → quantity
    ])
  })
  async addItem(productId: string, quantity: number) { ... }
}
```

内部通过 `zod-to-json-schema` 转换，框架直接以 `instance.addItem.apply(instance, args)` 执行：

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

if (options.inputSchema && '_def' in options.inputSchema) {
  resolvedSchema = zodToJsonSchema(options.inputSchema); // prefixItems 数组描述
}
```

### 方案二：简化 params 对象（快速书写，无校验）

```typescript
@mcpTool({
  description: '根据分类获取商品列表',
  params: {
    category: { type: 'string', description: '商品分类', required: true },
    page:     { type: 'number', description: '页码，从1开始' },
  }
})
async getProductsByCategory(category: string, page = 1) { ... }
```

内部转换为标准 JSON Schema：

```json
{
  "type": "object",
  "properties": {
    "category": { "type": "string", "description": "商品分类" },
    "page":     { "type": "number", "description": "页码，从1开始" }
  },
  "required": ["category"]
}
```

### 方案三：TypeScript emitDecoratorMetadata 自动推断（显式开启的兜底能力）

仅当业务侧显式满足以下前置条件时才启用：

1. `tsconfig.json` 开启 `"emitDecoratorMetadata": true`
2. 运行时接入 `reflect-metadata`
3. 接受"只能推断基础类型，无法获取参数描述/复杂对象结构"的限制

```
string    → { "type": "string" }
number    → { "type": "number" }
boolean   → { "type": "boolean" }
Array     → { "type": "array" }
Object/类 → { "type": "object" }（无法细化）
```

> ⚠️ 不作为默认能力，只作为显式 opt-in 的兜底手段。

### `McpToolOptions` 完整类型定义

```typescript
import type { ZodTuple, ZodTypeAny } from 'zod';

interface ParamDescriptor {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
}

interface McpToolOptions {
  /** Tool 描述，供 AI 理解用途（必填） */
  description: string;
  /** 自定义 Tool 名，默认为 {ServiceName}__{methodName} */
  name?: string;
  /** 方案一：传入 Zod Tuple，按位置描述函数参数（推荐，类型安全），语义等同 Function.apply */
  inputSchema?: ZodTuple<[ZodTypeAny, ...ZodTypeAny[]]> | ZodTuple<[], null>;
  /** 方案二：简化参数描述（快速书写，无 Zod 校验） */
  params?: ParamDescriptor[];
}
```

---

## `@mcpTool` 装饰器

被标注的方法会**额外**注册为独立的 Tool（与通用 3 个 Tool 并列），名称格式为 `{ServiceName}__{methodName}`。独立 Tool 的输入中携带 `instanceId` 精准路由到具体实例。

独立 Tool 的统一输入结构：

```typescript
{
  instanceId: string;  // list_services 返回的 instanceId
  args: unknown[];     // 位置参数数组，语义等同 Function.apply(instance, args)
}
```

> 说明：独立 Tool 和通用 `execute_action` 均使用 `args` 位置参数数组，语义完全统一。独立 Tool 的优势在于为每个参数提供精确的类型描述，让 AI 调用更准确。

### 使用示例（三种 Schema 写法对比）

```typescript
class CartService extends Service {
  // 写法一：Zod Tuple（精确，推荐）
  @mcpTool({
    description: '添加商品到购物车',
    inputSchema: z.tuple([
      z.string().describe('商品 ID'),                        // args[0] → productId
      z.number().int().min(1).default(1).describe('数量'),   // args[1] → quantity
    ])
  })
  async addItem(productId: string, quantity: number) { ... }

  // 独立 Tool 调用：
  // CartService__addItem({ instanceId: 'CartService#0', args: ['p-123', 2] })

  // 写法二：params 数组（快速）
  @mcpTool({
    description: '移除购物车中的商品',
    params: [
      { type: 'string', description: '商品 ID', required: true }  // args[0] → productId
    ]
  })
  async removeItem(productId: string) { ... }

  // 写法三：只写 description，靠显式开启的 emitDecoratorMetadata 兜底
  @mcpTool({ description: '清空购物车' })
  async clearCart() { ... }
}
```

---

## `McpBridge` 核心类设计

```typescript
class McpBridge {
  // 挂载到指定容器，自动发现容器内所有已实例化 Service
  mount(container: Container): void

  // 卸载，注销所有注册的 Tools
  unmount(): void

  // 支持手动注册额外 Service（不在容器内的场景）
  addService(name: string, instance: Service): void
}
```

### 挂载时的流程

1. 动态 `import('@mcp-b/global')` 初始化 WebMCP polyfill
2. 遍历 Container 树，收集所有 `definition.instance` 存在的 Service 实例
3. 以每个实例的 `instanceId` 为 key，建立 `Map<instanceId, ServiceInstance>` 路由表
4. 注册三个通用 Tools（`list_services`, `execute_action`, `get_state`）
5. 对有 `@mcpTool` 注解的方法扫描其 `prototype`，生成独立 Tool

这样可以保证：
- `mount()` 不触发任何实例化副作用（只遍历已有实例）
- 路由完全基于内存中的 `instanceId → instance` Map，无需反序列化 `ServiceIdentifier`
- 独立 Tool 的注册复用现有装饰器元数据

---

## 状态序列化策略

| 情况 | 处理方式 |
|------|---------|
| 函数属性 | 过滤，不作为状态输出 |
| 私有属性（`_` 或 `$` 开头，除 `$model`） | 过滤 |
| 循环引用 | 使用安全 JSON 序列化处理 |
| Observable Proxy | 直接读取属性值，不触发依赖追踪 |

---

## 文件结构

```
reactive-state/web-mcp/src/
├── main.ts                  # 包入口，导出所有公共 API
├── decorator.ts             # @mcpTool 装饰器实现
├── bridge.ts                # McpBridge 核心类
├── tools/
│   ├── list-services.ts     # list_services Tool 实现（只扫已实例化的 Service）
│   ├── execute-action.ts    # execute_action Tool 实现（基于 instanceId 路由）
│   └── get-state.ts         # get_state Tool 实现（基于 instanceId 路由）
├── utils/
│   ├── identifier.ts        # identifier 展示字段生成（getIdentifierLabel / getIdentifierType）
│   ├── serialize.ts         # 状态序列化工具
│   ├── schema.ts            # Schema 推断（Zod → JSON Schema / params → JSON Schema / metadata 兜底）
│   └── reflect.ts           # 反射工具，读取 @mcpTool 元数据
└── types.ts                 # 类型定义
```

---

## 依赖关系

```
@osgfe/rs-web-mcp
  ├── peerDependency: @osgfe/rs-service      （Service, Container，instanceId 由此提供）
  ├── peerDependency: zod                    （业务侧已有，不重复打包）
  ├── dependency:     zod-to-json-schema     （Zod Schema → JSON Schema 转换）
  └── dependency:     @mcp-b/global          （WebMCP polyfill，动态 import）
```

`@mcp-b/global` 采用**动态 import 懒加载**，只在 `mount()` 调用时才加载，避免 SSR/Node 环境报错。

---

## 完整使用示例

```typescript
import { z } from 'zod';
import { McpBridge, mcpTool } from '@osgfe/rs-web-mcp';
import { Container, Service } from '@osgfe/rs-service';

class CartService extends Service {
  items: CartItem[] = [];
  total = 0;

  @mcpTool({
    description: '添加商品到购物车',
    inputSchema: z.tuple([
      z.string().describe('商品 ID'),                      // args[0] → productId
      z.number().int().min(1).default(1).describe('数量'), // args[1] → quantity
    ])
  })
  async addItem(productId: string, quantity: number) { ... }

  async removeItem(productId: string) { ... }  // 无注解，仅通用 Tool 可访问
}

class OrderService extends Service {
  orders: Order[] = [];
}

const PAYMENT_SERVICE = Symbol('payment');
class PaymentService extends Service {
  balance = 0;
}

const container = new Container({ name: 'app' });
container.register(CartService);
container.register('orderService', OrderService);
container.register(PAYMENT_SERVICE, PaymentService);

// 触发实例化（通常由业务代码 resolve 驱动，此处手动演示）
container.resolve(CartService);
container.resolve('orderService');
container.resolve(PAYMENT_SERVICE);
// 实例化后：CartService#0 / orderService#1 / Symbol(payment)#2

const bridge = new McpBridge();
bridge.mount(container);

// AI Agent 交互：
//
// list_services
//   → [
//       { instanceId: 'CartService#0',      containerName: 'app', identifierLabel: 'CartService',     ... },
//       { instanceId: 'orderService#1',      containerName: 'app', identifierLabel: 'orderService',    ... },
//       { instanceId: 'Symbol(payment)#2',   containerName: 'app', identifierLabel: 'Symbol(payment)', ... }
//     ]
//
// execute_action({ instanceId: 'CartService#0',    action: 'removeItem',  args: ['p-123'] })
// execute_action({ instanceId: 'orderService#1',   action: 'fetchOrders', args: [] })
// execute_action({ instanceId: 'Symbol(payment)#2', action: 'recharge',   args: [100] })
//
// get_state({ instanceId: 'CartService#0' })
// get_state({ instanceId: 'Symbol(payment)#2', keys: ['balance'] })
//
// CartService__addItem({ instanceId: 'CartService#0', args: ['p-123', 2] })
```

---

## 关键设计决策

| 决策点 | 方案 | 原因 |
|--------|------|------|
| MCP 路由主键 | `instanceId`（`Service` 基类属性） | `ServiceIdentifier` 含函数引用/symbol，无法序列化；`instanceId` 由 Container 实例化时自动生成，字符串格式，天然可序列化 |
| `instanceId` 格式 | `{identifierLabel}#{自增序号}` | 前缀保留语义（一眼可读），序号保证全局唯一（即使同名 Service 多实例） |
| `identifierLabel` / `identifierType` | 保留在 `list_services` 输出中 | 仅展示和调试用，不参与路由 |
| `list_services` 扫描范围 | 只扫 `definition.instance` 存在的 Service | 避免触发实例化副作用；未被使用的 Service 不应暴露给 AI |
| Tool 命名 | `{ServiceName}__{methodName}` | 保持语义清晰 |
| Schema 推断优先级 | ZodTuple > params 数组 > emitDecoratorMetadata > `[]` | 均以位置数组语义统一，metadata 仅作为显式开启的兜底能力 |
| Zod 为 peerDep | 不打包 zod，由业务侧提供 | 避免版本冲突，保持包体积小 |
| 状态获取方式 | 快照（非实时订阅） | WebMCP 是请求-响应模式，不支持 push |
| 动态 import WebMCP | `mount()` 时 lazy import | 避免 SSR 环境 `navigator` 不存在的问题 |

---

## React Container Tree 集成方案

### 问题背景

在真实 React 项目中，`@osgfe/rs-react` 的 `bindServices` 将 Container 与组件生命周期绑定：

- 每个 `bindServices` 包裹的组件挂载时**创建专属 Container**，作为父容器的子节点
- 组件卸载时 Container 进入待回收状态（通过 `FinalizationRegistry` 延迟 destroy，非同步 destroy）
- Container 自身维护完整的 `parent → children` 树，提供 `getChildren()` / `getParent()` 遍历 API

```
globalContainer（RSRoot）
  └── OrderPage_1                          ← bindServices(OrderPage, [OrderService])
        ├── [OrderService#0 实例]
        └── OrderList_2                    ← bindServices(OrderList, [OrderListService])
              └── [OrderListService#1 实例]
```

> ⚠️ **注意**：由于 `bindServices` 在组件卸载时并不同步调用 `container.destroy()`，已卸载组件的 Container 在 GC 之前仍可能通过 `getChildren()` 被遍历到。`list_services` / `get_state` 因此可能返回已失活的陈旧实例——这是当前的已知行为，暂不处理。

---

### 关键洞察：`McpRegistry` 不需要维护 Container 列表

Container 树的结构**已经由 `bindServices` 自动维护**，`McpRegistry` **只需持有 `rootContainer`（即 `globalContainer`）**，在每次 Tool 调用时实时遍历树。

```typescript
// rs-web-mcp/registry.ts
import { getGlobalContainer } from '@osgfe/rs-service';
import type { Container } from '@osgfe/rs-service';

class McpRegistry {
  private static instance: McpRegistry;

  static getInstance(): McpRegistry { ... }

  /**
   * 递归遍历 Container 树，收集所有已实例化的 Service 实例
   * 以 instanceId 为 key 构建路由 Map
   */
  buildInstanceMap(): Map<string, Service> {
    const map = new Map<string, Service>();

    function walk(container: Container) {
      for (const definition of container.getServiceDefinitions()) {
        if (definition.instance) {
          const svc = definition.instance as Service;
          map.set(svc.instanceId, svc);
        }
      }
      for (const child of container.getChildren()) {
        walk(child);
      }
    }

    walk(getGlobalContainer());
    return map;
  }
}
```

每次 Tool 调用时重新 `buildInstanceMap()`，保证实时性。

---

### `rs-react` 无需任何改动

```
McpBridge / list_services / execute_action / get_state
  └── 调用 McpRegistry.buildInstanceMap()
        └── 从 getGlobalContainer() 出发，递归 getChildren() 实时遍历
              └── 只收集 definition.instance 存在的 Service，读取 instanceId
```

**不依赖 `rs-react`，不依赖任何 React 相关内容。**

---

### 增强后的 `list_services` Tool

遍历所有 Container，返回已实例化 Service 的快照：

```
输出: {
  services: [
    {
      instanceId: "OrderService#0",
      containerName: "OrderPage_1",
      identifierType: "constructor",
      identifierLabel: "OrderService",
      actions: [ ... ],
      stateKeys: [ "orders", "total" ]
    },
    {
      instanceId: "OrderListService#1",
      containerName: "OrderList_2",
      identifierType: "constructor",
      identifierLabel: "OrderListService",
      actions: [ ... ],
      stateKeys: [ "items" ]
    }
  ]
}
```

---

### 与 `McpBridge` 的关系

| 场景 | 使用方式 |
|------|---------|
| **快速接入**（单 Container） | `new McpBridge().mount(someContainer)` |
| **React / 多 Container 场景** | `McpRegistry` 自动遍历全局 Container 树 |

两者路由均基于 `instanceId`，调用面完全统一。

---

### 文件结构

```
reactive-state/
├── service/src/
│   ├── service.ts           # ✅ Service 基类新增 instanceId 字段
│   └── ioc/container.ts     # ✅ instantiate() 实例化后回写 instanceId
│
├── react/                   # ✅ 无需任何改动
│
└── web-mcp/src/
    ├── main.ts              # 包入口
    ├── decorator.ts         # @mcpTool 装饰器
    ├── bridge.ts            # McpBridge（单 Container 快速接入）
    ├── registry.ts          # McpRegistry（遍历全局 Container 树）
    ├── tools/
    │   ├── list-services.ts # list_services（只扫已实例化 Service）
    │   ├── execute-action.ts# execute_action（基于 instanceId 路由）
    │   └── get-state.ts     # get_state（基于 instanceId 路由）
    ├── utils/
    │   ├── identifier.ts    # identifier 展示字段生成
    │   ├── serialize.ts
    │   ├── schema.ts
    │   └── reflect.ts
    └── types.ts
```

---

### 完整使用示例（业务视角）

**`rs-react` 和业务组件零改动**，只需在应用入口初始化一次 WebMCP：

```typescript
// ✅ app/main.tsx —— 唯一改动，初始化 WebMCP
import { McpRegistry } from '@osgfe/rs-web-mcp';

McpRegistry.getInstance().mount();

// ✅ 业务 Service —— 可选加 @mcpTool
import { Service } from '@osgfe/rs-react';
import { mcpTool } from '@osgfe/rs-web-mcp';
import { z } from 'zod';

class OrderService extends Service {
  orders: Order[] = [];

  @mcpTool({
    description: '获取订单列表',
    inputSchema: z.tuple([
      z.number().default(1).describe('页码'),  // args[0] → page
    ])
  })
  async fetchOrders(page: number) { ... }

  async cancelOrder(id: string) { ... }
}

// ✅ 业务组件 —— 零改动
function OrderPage() {
  const orderService = useService(OrderService);
  // useService 触发 resolve → OrderService 实例化 → instanceId = 'OrderService#0'
  return <div>...</div>;
}

export default bindServices(OrderPage, [OrderService]);


// ✅ AI Agent 此时可以访问：
//
// list_services
//   → [{ instanceId: 'OrderService#0', containerName: 'OrderPage_1', identifierLabel: 'OrderService', ... }]
//
// execute_action({ instanceId: 'OrderService#0', action: 'fetchOrders', args: [1] })
// get_state({ instanceId: 'OrderService#0' })
// OrderService__fetchOrders({ instanceId: 'OrderService#0', args: [2] })
```
