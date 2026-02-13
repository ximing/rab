# RAB - 响应式状态管理库

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.19.0-green)
![pnpm](https://img.shields.io/badge/pnpm-10.22.0-orange)
![License](https://img.shields.io/badge/License-MIT-green)

**现代化、高性能的响应式状态管理解决方案**

观察者模式 | 服务容器 | React 集成 | TypeScript 优先

</div>

## 🚀 项目简介

RAB 是一个专业的 monorepo 项目，为现代前端应用提供高质量的响应式状态管理解决方案。核心产品包括**观察者库**、**服务容器**和**React 集成方案**，为前端应用开发提供坚实的基础。

### ✨ 核心特性

- 🎯 **响应式观察者** - 高效的观察者模式实现，支持细粒度追踪
- 🔌 **服务容器** - 灵活的服务管理容器，支持装饰器和依赖注入
- ⚛️ **React 集成** - 与 React 深度集成的状态管理方案
- 📦 **Monorepo 管理** - 基于 pnpm + Turborepo 的高效包管理
- 🎯 **TypeScript 优先** - 完整的类型安全和开发体验
- 🧪 **高质量测试** - Jest 测试框架，完整的测试覆盖
- 📚 **完整文档** - 详细的 API 文档和使用指南

## 📦 项目结构

```
rab/
├── packages/                      # 📦 核心包
│   ├── observer/                  # 观察者库 (@rabjs/observer)
│   ├── service/                   # 服务容器 (@rabjs/service)
│   └── react/                     # React 集成 (@rabjs/react)
├── examples/                      # 📚 示例项目
│   └── reactive-state/            # 响应式状态示例应用
├── configs/                       # ⚙️ 共享配置
│   ├── eslint-config-custom/      # ESLint 规则
│   └── tsconfig/                  # TypeScript 配置
├── website/                       # 📖 文档网站
└── scripts/                       # 🔧 构建和发布脚本
```

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 20.19.0
- **pnpm**: 10.22.0
- **Git**: 任意版本

### 安装依赖

```bash
# 克隆仓库
git clone <repository-url>
cd rab

# 安装依赖
pnpm install
```

### 开发模式

```bash
# 启动所有包的开发模式
pnpm dev

# 仅开发示例应用
cd examples/reactive-state && pnpm dev
```

### 构建项目

```bash
# 构建所有包
pnpm build

# 清理构建产物
pnpm clean
```

## 📚 核心库介绍

### 1. @rabjs/observer - 观察者库

高效的观察者模式实现，提供细粒度的响应式追踪和自动更新机制。

**主要特性**:

- 细粒度响应式追踪
- 自动依赖收集
- 高性能更新机制
- 完整的 TypeScript 支持
- 内存泄漏防护

**使用示例**:

```typescript
import { observable, observer } from '@rabjs/observer';

const state = observable({ count: 0 });
const dispose = observer(() => {
  console.log('Count:', state.count);
});

state.count = 5; // 自动触发观察者
dispose(); // 清理观察者
```

### 2. @rabjs/service - 服务容器

灵活的服务管理容器，支持装饰器、依赖注入和生命周期管理。

**主要特性**:

- 装饰器支持（@Injectable、@Inject 等）
- 类型安全的依赖注入
- 生命周期管理
- 事件系统集成
- 循环依赖检测

**使用示例**:

```typescript
import { Injectable, Inject, Container } from '@rabjs/service';

@Injectable()
class UserService {
  getUser(id: number) {
    return { id, name: 'User' };
  }
}

@Injectable()
class UserController {
  constructor(@Inject(UserService) private userService: UserService) {}

  getUser(id: number) {
    return this.userService.getUser(id);
  }
}

const container = new Container();
container.register(UserService);
container.register(UserController);
const controller = container.get(UserController);
```

### 3. @rabjs/react - React 集成

与 React 深度集成的状态管理方案，提供 Hooks 和组件级别的状态管理。

**主要特性**:

- React Hooks 支持（useObserver、useLocalObservable 等）
- 自动组件更新
- 性能优化
- 服务容器集成
- 开发者工具支持

**使用示例**:

```typescript
import { useLocalObservable, observer } from '@rabjs/react';

const Counter = observer(() => {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    }
  }));

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.increment()}>Increment</button>
    </div>
  );
});
```

## 🧪 测试和质量保证

### 测试要求

- **覆盖率**: 最低 80% (分支、函数、行、语句)
- **测试框架**: Jest + ts-jest
- **测试超时**: 30 秒
- **CI/CD**: 自动化测试和发布

### 运行测试

```bash
# 运行所有测试
pnpm test

# 使用 Turbo 并行测试
pnpm test:turbo

# 监听模式
cd packages/observer && npm run test:watch

# 覆盖率报告
cd packages/observer && npm run test:coverage
```

## 🔄 版本管理和发布

本项目使用 [Changesets](https://github.com/changesets/changesets) 进行版本管理：

### 发布流程

```bash
# 1. 创建变更集
pnpm changeset

# 2. 版本升级
pnpm version-packages

# 3. 发布检查
pnpm publish:check

# 4. 发布到 mnpm
pnpm publish:mnmp

# 5. 提交代码
git push origin <branch>
```

### 发布配置

- **Access**: public
- **License**: MIT

## 🛠️ 开发工具和命令

### 根级命令

```bash
# 开发
pnpm dev                    # 启动所有包的开发模式

# 构建
pnpm build                  # 构建所有包
pnpm clean                  # 清理构建产物
pnpm clean:node-modules     # 删除所有 node_modules

# 代码质量
pnpm lint                   # 代码检查
pnpm lint:turbo             # 使用 Turbo 并行检查
pnpm lint:fix               # 自动修复
pnpm lint:error             # 仅显示错误
pnpm lint:error:fix         # 修复错误
pnpm format                 # 代码格式化

# 测试
pnpm test                   # 运行测试
pnpm test:turbo             # 使用 Turbo 并行测试

# 版本管理
pnpm changeset              # 创建变更集
pnpm version-packages       # 版本升级
pnpm publish:check          # 发布检查
pnpm publish:mnmp           # 发布到 mnpm
```

### 单个包开发

```bash
# 进入特定包目录进行开发
cd packages/observer && npm run dev        # 开发模式
cd packages/observer && npm run build      # 构建
cd packages/observer && npm run test       # 测试
cd packages/observer && npm run test:watch # 监听模式
```

## 📋 代码规范

### TypeScript 配置

- **严格模式**: 启用所有严格检查
  - `strict: true`
  - `noImplicitAny: true`
  - `strictNullChecks: true`
  - `noImplicitReturns: true`
  - `noUncheckedIndexedAccess: true`

### 代码风格

- **Linter**: ESLint 9.17.0
- **Formatter**: Prettier 2.8.8
- **提交规范**: Conventional Commits
- **Git Hooks**: Husky 9.1.7 + lint-staged 16.2.6

### 开发规范

1. **类型安全**: 优先使用 TypeScript，避免 `any` 类型
2. **测试覆盖**: 新功能必须包含测试，保持 80% 覆盖率
3. **代码风格**: 遵循 ESLint 和 Prettier 配置
4. **提交规范**: 使用 [Conventional Commits](https://conventionalcommits.org/)
5. **文档更新**: 重要变更需要更新相关文档

## 🤝 贡献指南

### 提交流程

```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 开发和测试
pnpm dev
pnpm test

# 3. 代码检查和格式化
pnpm lint:fix
pnpm format

# 4. 提交代码
git add .
git commit -m "feat: add new feature"

# 5. 创建变更集
pnpm changeset

# 6. 提交 PR
git push origin feature/new-feature
```

## 📊 包依赖关系

```
@rabjs/observer (观察者库)
    ↓
@rabjs/service (服务容器)
    ↓
@rabjs/react (React 集成)
```

## 🔧 关键配置文件

### 根级配置

- `package.json` - Monorepo 脚本和依赖
- `turbo.json` - Turborepo 任务配置
- `pnpm-workspace.yaml` - 工作区定义
- `tsconfig.json` - 根 TypeScript 配置
- `eslint.config.js` - ESLint 规则

### 包级配置

- `package.json` - 包信息和脚本
- `tsconfig.json` - 包特定的 TypeScript 配置
- `jest.config.js` - 测试配置
- `build.config.ts` - 构建配置

## 📈 性能和优化

### 构建性能

- **并行构建**: Turborepo 自动并行化依赖构建
- **增量构建**: 智能缓存和依赖分析
- **按需加载**: 包按需加载和初始化
- **优化输出**: 支持 CJS、ESM 和 TypeScript 类型

### 开发体验

- **快速启动**: 秒级开发服务器启动
- **监听模式**: 自动重新构建
- **错误隔离**: 包错误不影响其他包
- **类型提示**: 完整的 TypeScript 智能提示

## 🛡️ 生产状态

### ✅ 生产就绪

- ✅ @rabjs/observer - 观察者库
- ✅ @rabjs/service - 服务容器
- ✅ @rabjs/react - React 集成方案

### 📚 文档

- 📖 各包目录下的 README.md
- 📋 API 文档和使用示例
- 🔍 源代码注释和类型定义
- 📚 完整的文档网站（website 目录）

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 🙋‍♂️ 支持和反馈

- **Issues**: 提交问题和建议
- **讨论**: 参与项目讨论
- **文档**: 查看各包的 README 和文档
- **示例**: 查看 examples/reactive-state 目录

---

<div align="center">

**RAB - 现代化的响应式状态管理库** ❤️

[📚 文档](./website) | [🔧 开发指南](#开发工具和命令) | [🚀 快速开始](#快速开始) | [🤝 贡献](#贡献指南)

</div>