---
name: km-rsjs-core-to-rs-react
description: Migration skill for converting codebase from @rsjs/core to @rabjs/react. Use this skill when the user asks to migrate, upgrade, or refactor from @rsjs/core to @rabjs/react, or mentions "rsjs迁移", "rsjs改rs-react", "@rsjs/core换@rabjs/react", "从rsjs迁移到rs-react". Covers all API mapping, decorator changes, component pattern changes, and verification steps.
---

# @rsjs/core → @rabjs/react 迁移规则

本 skill 定义了从 `@rsjs/core` 迁移到 `@rabjs/react` 的完整规则。迁移时严格按照以下规则逐条执行，不可遗漏。

---

## 1. 导入源替换

**规则**：所有 `@rsjs/core` 的导入必须替换为 `@rabjs/react`。

```typescript
// ❌ 旧
import { Service, Inject, Debounce, view, useService, bindServices } from "@rsjs/core";

// ✅ 新
import { Service, Inject, Debounce, observer, useService, bindServices } from "@rabjs/react";
```

**注意**：替换后需检查导入的符号在新库中是否仍然存在，移除不再需要的导入（如 `Injectable` 在 `@rabjs/react` 中不存在）。

---

## 2. Service 类声明方式变更

**规则**：Service 类不再使用 `@Service()` 或 `@Injectable()` 装饰器，改为继承 `Service` 基类。

```typescript
// ❌ 旧：使用装饰器
@Service()
export class UserService {
  // ...
}

@Injectable()
export class UserService {
  // ...
}

// ✅ 新：继承 Service 基类
export class UserService extends Service {
  // ...
}
```

**关键点**：
- `@Service()` 装饰器在 `@rabjs/react` 中**不存在**，必须移除
- `@Injectable()` 装饰器在 `@rabjs/react` 中**不存在**，必须移除
- 所有 Service 类必须 `extends Service`

---

## 3. 依赖注入方式变更

**规则**：`@Inject` 属性装饰器替换为 getter + `this.resolve()` 模式。

```typescript
// ❌ 旧：@Inject 装饰器
@Inject(NavigationService)
private navigationService!: NavigationService;

// ✅ 新：getter + resolve
get navigationService() {
  return this.resolve(NavigationService);
}
```

**关键点**：
- 旧写法是类属性 + 装饰器，新写法是 getter 方法
- `this.resolve()` 沿作用域链向上查找：当前容器 → 父级容器 → 全局注册
- 移除 `@Inject` 的导入（除非项目中其他地方仍需使用 `@Inject`）
- 如果旧代码中有 `private` 修饰符，新 getter 不要加 `private`（getter 本身就是访问接口）

**多依赖示例**：

```typescript
// ❌ 旧
@Inject(LoggerService)
private logger!: LoggerService;

@Inject(ApiService)
private api!: ApiService;

// ✅ 新
get loggerService() {
  return this.resolve(LoggerService);
}

get apiService() {
  return this.resolve(ApiService);
}
```

---

## 4. 组件包裹方式变更

**规则**：函数组件的 `view()` 包裹替换为 `observer()`。

```typescript
// ❌ 旧
import { view } from "@rsjs/core";
const MyComponent = view(() => {
  // ...
});

// ✅ 新
import { observer } from "@rabjs/react";
const MyComponent = observer(() => {
  // ...
});
```

**关键点**：
- `view()` 和 `observer()` 功能等价，但 `observer()` 是 `@rabjs/react` 的推荐方式
- 如果旧代码中组件已经用了 `observer()`（从 `@rsjs/core` 导入），只需替换导入源，不需改组件包裹方式
- 类组件仍可使用 `view()`，但函数组件统一推荐 `observer()`

---

## 5. `@Debounce` 装饰器参数变更

**规则**：`@Debounce()` 必须传入等待时间（毫秒），不可省略参数。

```typescript
// ❌ 旧：无参数
@Debounce()
async searchUser(mis: string) { ... }

// ✅ 新：必须传入毫秒数
@Debounce(300)
async searchUser(mis: string) { ... }
```

**关键点**：
- `@rabjs/react` 的 `@Debounce` 要求必传 `wait` 参数
- 根据原代码逻辑选择合理的防抖时间（常见值：300ms 用于搜索，500ms 用于筛选，1000ms 用于数据刷新）
- `@Throttle` 同理，也必须传入等待时间

---

## 6. 组件导出与 `bindServices` 配合

**规则**：如果组件内部使用了 `useService(XxxService)` 但组件本身未被 `bindServices` 包裹，需要用 `bindServices` 包裹导出。

```typescript
// ❌ 旧：直接导出，依赖外部 bindServices
const PageList = view(({ projectId }) => {
  const service = useService(ProjectService);
  // ...
});
export default PageList;

// ✅ 新：组件自身用 bindServices 注册依赖
const PageList = observer(({ projectId }) => {
  const service = useService(ProjectService);
  // ...
});
export default bindServices(PageList, [ProjectService]);
```

**关键点**：
- 只有组件内**使用了 `useService`** 时才需要 `bindServices`
- 纯展示组件（只通过 props 接收数据）不需要 `bindServices`
- 如果组件已经有 `bindServices` 包裹，只需替换导入源

---

## 7. `useService` 的 `scope: Transient` 选项移除

**规则**：旧代码中 `useService(XxxService, { scope: Transient })` 的第二个参数 `{ scope: Transient }` 必须移除，改为 `useService(XxxService)`。

```typescript
// ❌ 旧：显式传入 Transient scope
import { useService, view, Transient } from '@rsjs/core';

const MyPage = view(() => {
  const service = useService(IndexService, { scope: Transient });
  // ...
});
export default MyPage;

// ✅ 新：由 bindServices 保证每个组件实例独立的 Service，无需 Transient
import { useService, observer, bindServices } from '@rabjs/react';

const MyPage = observer(() => {
  const service = useService(IndexService);
  // ...
});
export default bindServices(MyPage, [IndexService]);
```

**关键点**：
- `bindServices` 会为每个组件实例创建独立的 DI 容器，天然保证 Service 实例与组件生命周期绑定，效果等同于旧的 `Transient` scope
- 移除 `{ scope: Transient }` 后，`Transient` 符号不再被使用，同时需要从导入语句中删除 `Transient`
- 如果导入行只剩 `useService` 和 `observer`/`bindServices`，移除 `Transient` 后确保导入语句无多余逗号

**配套操作**：移除导入中的 `Transient`：

```typescript
// ❌ 旧导入（含 Transient）
import { useService, observer, bindServices, Transient } from '@rabjs/react';

// ✅ 新导入（去掉 Transient）
import { useService, observer, bindServices } from '@rabjs/react';
```

---

## 8. 全局 Service 注册方式

**规则**：全局单例 Service 使用 `register()` 注册，**禁止**使用 `bindServices`。

```typescript
// ❌ 旧：可能在应用入口使用容器注册
container.register(UserService);

// ✅ 新：使用 register 函数
import { register } from "@rabjs/react";
register(UserService);
```

**关键点**：
- 全局 Service 在应用启动时（如 `main.tsx`）用 `register()` 注册
- 全局 Service 生命周期与应用一致
- 页面/组件级 Service 用 `bindServices` 注册，生命周期与组件绑定

---

## 9. 异步方法状态追踪

**规则**：`@rabjs/react` 中异步方法自动追踪 `loading` 和 `error` 状态，通过 `$model.methodName` 访问。

```typescript
// Service 中的异步方法
export class DataService extends Service {
  async fetchData() {
    const response = await fetch("/api/data");
    this.data = await response.json();
  }
}

// 组件中访问异步状态
const Component = observer(() => {
  const service = useService(DataService);

  // ✅ 自动生成的状态
  if (service.$model.fetchData.loading) return <div>加载中...</div>;
  if (service.$model.fetchData.error) return <div>错误</div>;

  return <div>{service.data}</div>;
});
```

**关键点**：
- 旧代码中如果手动维护 `loading`/`error` 状态，可以考虑迁移为 `$model` 自动追踪
- 这是渐进式优化，不影响核心迁移，但推荐在新代码中使用

---

## 10. 迁移后验证清单

每完成一个模块的迁移后，必须执行以下验证：

1. **导入检查**：`grep -r "@rsjs/core" src/` 应返回 0 结果（排除文档文件如 `.md`）
2. **装饰器检查**：`grep -r "@Service()" src/` 和 `grep -r "@Injectable()" src/` 应返回 0 结果
3. **`@Inject` 检查**：确认所有 `@Inject` 装饰器已替换为 getter + resolve（除非 `@Inject` 来自 `@rabjs/react`）
4. **`@Debounce` 参数检查**：`grep -r "@Debounce()" src/` 应返回 0 结果
5. **TypeScript 编译**：运行 `tsc --noEmit` 确认零错误
6. **功能验证**：启动开发服务器确认页面正常渲染
7. **严格模式验证**：在应用入口用 `RSRoot` + `RSStrict` 包裹根组件，确认无 Service 未注册的运行时报错

---

## 11. 扫描未注册 Service 并决策注册方式

**规则**：代码迁移完成后、开启严格模式前，必须扫描出所有 `useService` 使用的 Service，找出其中尚未通过 `register` 或 `bindServices` 注册的 Service，列给用户决策注册方式。

### 扫描步骤

**第一步：列出所有被 `useService` 引用的 Service 类**

```bash
# 在项目 src 目录下搜索所有 useService 调用，提取 Service 类名
grep -rn "useService(" src/ --include="*.ts" --include="*.tsx" \
  | grep -oP "useService\(\K[A-Za-z]+"
```

**第二步：找出已通过 `register` 注册的 Service**

```bash
# 搜索 register(...) 调用
grep -rn "register(" src/ --include="*.ts" --include="*.tsx" \
  | grep -oP "register\(\K[A-Za-z]+"
```

**第三步：找出已通过 `bindServices` 注册的 Service**

```bash
# 搜索 bindServices 第二参数中的 Service 类名
grep -rn "bindServices(" src/ --include="*.ts" --include="*.tsx"
```

**第四步**：对比步骤一的全量列表与步骤二、三的注册列表，**差集即为未注册的 Service**。

### 向用户展示决策清单

对每个未注册的 Service，按以下格式列出，让用户逐一决策：

```
以下 Service 当前未注册，请为每个选择注册方式：

┌─────────────────────────┬──────────────────────────────────────┬─────────────────────────────────────┐
│ Service 类名             │ 被哪些组件使用                        │ 推荐注册方式                          │
├─────────────────────────┼──────────────────────────────────────┼─────────────────────────────────────┤
│ UserService             │ UserPage, UserCard                   │ [A] register  /  [B] bindServices   │
│ ProductService          │ ProductListPage                      │ [A] register  /  [B] bindServices   │
│ LoggerService           │ 多个页面和组件                        │ [A] register  /  [B] bindServices   │
└─────────────────────────┴──────────────────────────────────────┴─────────────────────────────────────┘
```

### 决策依据

帮助用户根据以下原则做出选择：

| 选择 | 注册方式 | 适用场景 |
|---|---|---|
| **A. `register`（全局单例）** | `register(XxxService)` 写在 `main.tsx` | Service 在多个无关页面/组件中使用；Service 持有跨页面共享的状态；如 Logger、Auth、Config |
| **B. `bindServices`（组件级）** | `bindServices(Component, [XxxService])` | Service 只被单个页面或组件树使用；Service 的状态应随组件卸载而销毁；如页面表单状态、局部列表数据 |

**推荐判断规则（AI 可自动预判，供用户确认）**：
- 被 **3 个以上不同目录**的组件使用 → 倾向 `register`
- 只在 **同一页面目录**下使用 → 倾向 `bindServices`
- Service 名含 `Logger`、`Auth`、`Config`、`App`、`Router`、`Theme` → 倾向 `register`
- Service 名含 `Page`、`Form`、`List`、`Detail`、`Modal` → 倾向 `bindServices`

### 执行决策

用户确认后，按选择执行：

**选 A（register）**：在 `main.tsx` 中追加注册

```typescript
// main.tsx
import { register } from "@rabjs/react";
import { UserService } from "./services/user.service";
import { LoggerService } from "./services/logger.service";

register(UserService);
register(LoggerService);
```

**选 B（bindServices）**：在对应组件文件中补充 `bindServices` 包裹

```typescript
// UserPage.tsx
export default bindServices(UserPage, [UserService]);
```

---

## 12. 开启严格模式（RSStrict）

**规则**：迁移完成后，在应用根部用 `RSRoot` + `RSStrict` 包裹整个应用，启用严格模式。

### 什么是严格模式？

严格模式（`RSStrict`）是 `@rabjs/react` 提供的组件树隔离机制，用于规范 Service 的注册方式：

- **严格模式下**：所有 `useService` 使用的 Service **必须**通过 `register` 或 `bindServices` 显式注册，否则运行时抛出异常
- **非严格模式下**：未注册的 Service 会被自动注册为全局单例（旧 `@rsjs/core` 的默认行为）

> **迁移建议**：新迁移的项目应在完成全部迁移并验证后开启严格模式。从旧版 RSJS 升级的项目可先不开，待逐步补齐 `bindServices` 注册后再开启。

### 开启方式

在应用入口文件（`main.tsx` / `index.tsx`）中，用 `RSRoot` + `RSStrict` 包裹根组件：

```typescript
// ❌ 旧：未启用严格模式（迁移前）
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// ✅ 新：启用严格模式（迁移后）
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RSRoot, RSStrict } from "@rabjs/react";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RSRoot>
      <RSStrict>
        <App />
      </RSStrict>
    </RSRoot>
  </StrictMode>
);
```

**关键点**：
- `RSRoot` 是 RSJS 的根容器，**必须**位于最外层（包在 `RSStrict` 外）
- `RSStrict` 启用严格注册检查，放在 `RSRoot` 内
- React 自带的 `<StrictMode>` 可以同时保留，放在最外层
- 两者导入均来自 `@rabjs/react`：`import { RSRoot, RSStrict } from "@rabjs/react"`

### 严格模式下的常见报错修复

开启严格模式后，如遇到 Service 未注册报错，需检查：

1. 组件使用了 `useService(XxxService)` 但未配套 `bindServices`：
   ```typescript
   // ❌ 缺少 bindServices
   const MyPage = observer(() => {
     const service = useService(MyService); // 严格模式下报错
     return <div />;
   });
   export default MyPage;

   // ✅ 补充 bindServices
   const MyPage = observer(() => {
     const service = useService(MyService);
     return <div />;
   });
   export default bindServices(MyPage, [MyService]);
   ```

2. 全局 Service 未用 `register` 注册：
   ```typescript
   // ❌ 未注册
   // main.tsx 中没有 register(GlobalService)

   // ✅ 在应用启动时注册
   import { register } from "@rabjs/react";
   register(GlobalService);
   ```

---

## 13. API 映射速查表

| `@rsjs/core` | `@rabjs/react` | 说明 |
|---|---|---|
| `import { ... } from "@rsjs/core"` | `import { ... } from "@rabjs/react"` | 导入源替换 |
| `@Service()` | `extends Service` | 类声明方式 |
| `@Injectable()` | _(移除，改用 `extends Service`)_ | 不再需要 |
| `@Inject(XxxService) private xxx!: XxxService` | `get xxx() { return this.resolve(XxxService); }` | 依赖注入 |
| `view(() => { ... })` | `observer(() => { ... })` | 函数组件包裹 |
| `@Debounce()` | `@Debounce(300)` | 必须传毫秒参数 |
| `@Throttle()` | `@Throttle(100)` | 必须传毫秒参数 |
| `container.register(Xxx)` | `register(Xxx)` | 全局注册 |
| `Service` 基类 | `Service` 基类 | 仍然存在，但必须显式继承 |
| `useService(Xxx, { scope: Transient })` | `useService(Xxx)` | `bindServices` 已保证实例隔离，移除第二参数及 `Transient` 导入 |
| _(无)_ | `RSRoot` + `RSStrict` | 应用入口开启严格模式，强制要求 Service 必须显式注册 |

---

## 14. 并行迁移策略

当迁移涉及大量文件时，推荐按模块分组并行处理：

1. **分组原则**：按目录/模块分组，每组 5-8 个文件
2. **典型分组**：
   - `src/services/` — 全局服务
   - `src/modules/[module-name]/services/` — 模块服务
   - `src/modules/[module-name]/pages/` — 页面组件
   - `src/modules/[module-name]/components/` — 子组件
3. **依赖顺序**：先迁移 Service 文件（被依赖方），再迁移组件文件（依赖方）
4. **验证时机**：每组完成后立即验证，避免错误累积
5. **使用 subAgent**：每组文件可分配给一个独立的 subAgent 并行处理，提高效率

---

## 15. 常见陷阱

1. **忘记移除 `@Injectable()` 或 `@Service()`**：这些装饰器在新库中不存在，会导致编译错误
2. **`@Debounce()` 无参数**：新库要求必传参数，遗漏会导致类型错误
3. **解构 observable 对象**：在 `observer` 组件内解构 Service 属性会破坏响应性，应直接通过 `service.xxx` 访问
4. **忘记 `bindServices`**：如果组件使用了 `useService` 但未用 `bindServices` 包裹，运行时会报错找不到 Service
5. **混用 `view` 和 `observer`**：迁移后应统一使用 `observer`，保持代码风格一致
6. **`@Inject` 残留导入**：如果 `@Inject` 来自旧库，需确认新库也导出了 `@Inject` 才能保留，否则移除并替换为 getter + resolve
7. **`Transient` 残留**：迁移后导入中仍保留 `Transient` 会导致编译错误（`@rabjs/react` 不导出该符号）；同时 `useService(XxxService, { scope: Transient })` 的第二参数也须一并删除，否则运行时报错
