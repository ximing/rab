# Observer 测试文件结构

## 概述

本目录包含 `@rabjs/observer` 响应式状态库的完整测试套件。测试文件已按照功能模块进行组织，使其更清晰地反映测试内容。

## 目录结构

```
__tests__/
├── handlers/                          # 代理处理器测试
│   ├── baseProxyHandler.test.ts       # 基础代理处理器测试
│   ├── shadowProxyHandler.test.ts     # 影子代理处理器测试
│   ├── collectionHandler.test.ts      # 集合处理器测试
│   └── shadowCollectionHandler.test.ts # 影子集合处理器测试
│
├── edge-cases/                        # 边界情况和特殊场景测试
│   └── reactionTrack.test.ts          # 响应式追踪系统测试
│
├── builtIns/                          # 内置类型测试
│   ├── Map.test.ts
│   ├── Set.test.ts
│   ├── WeakMap.test.ts
│   ├── WeakSet.test.ts
│   ├── builtIns.test.ts
│   └── typedArrays.test.ts
│
├── observable.test.ts                 # observable 基础功能测试
├── shadowObservable.test.ts           # shadowObservable 基础功能测试
├── shadowObservable.collection.test.ts # shadowObservable 集合操作测试
├── observe.test.ts                    # observe 功能测试
├── unobserve.test.ts                  # unobserve 功能测试
├── debug.test.ts                      # 调试功能测试
└── README.md                          # 本文件
```

## 测试文件说明

### handlers/ 目录

#### baseProxyHandler.test.ts

测试基础代理处理器的各种操作：

- **基础操作**: get、set、deleteProperty、has、ownKeys
- **Symbol 处理**: Symbol 属性、well-known symbols、Symbol.iterator
- **属性描述符**: getter/setter、不可配置属性、Object.defineProperty
- **原型链处理**: 原型链中的 setter、receiver 处理
- **construct 操作**: 类构造函数代理
- **数组操作**: length、索引访问、push、pop
- **Object 方法**: assign、entries、values、getOwnPropertyNames 等
- **序列化**: JSON.stringify、spread 操作符
- **特殊对象**: Object.freeze、Object.seal
- **响应式追踪**: 相同值不触发、新增属性、删除属性
- **集合操作**: Map.set、Set.add

#### shadowProxyHandler.test.ts

测试影子代理处理器（不包装嵌套对象）：

- 所有 baseProxyHandler 的操作
- **嵌套对象处理**: 不包装嵌套对象、支持替换嵌套对象
- **数组操作**: push、pop、索引访问的响应式

#### collectionHandler.test.ts

测试集合类型（Map、Set、WeakMap、WeakSet）的处理：

- **Map 操作**: set、delete、clear、get、has、forEach、keys、values、entries、size
- **Set 操作**: add、delete、clear、has、forEach、values、keys、entries、size
- **WeakMap 操作**: 基本操作、get 返回 undefined
- **WeakSet 操作**: 基本操作
- **非集合对象处理**: 在非集合对象上调用集合方法的处理
- **返回值验证**: 各方法的返回值类型

#### shadowCollectionHandler.test.ts

测试影子集合处理器（返回原始值而不是 observable）：

- 所有 collectionHandler 的操作
- **原始值返回**: get、forEach、values、entries 返回原始值而不是 observable
- **WeakMap/WeakSet**: 返回原始值的特殊处理

### edge-cases/ 目录

#### reactionTrack.test.ts

测试响应式追踪系统的各种边界情况：

- **基础追踪**: connectionStore、reactionsForTarget 处理
- **集合操作追踪**: clear、add、delete 操作的依赖追踪
- **对象操作追踪**: 属性添加、删除、iterate、has 操作
- **数组操作追踪**: length 变化追踪
- **多个 reactions**: 多个 reactions 依赖同一属性、reaction 清理、嵌套 reactions
- **复杂场景**: 复杂 Map/Set 操作、嵌套对象响应式、多个 reactions 在同一属性

## 测试统计

- **总测试文件**: 18 个
- **处理器测试**: 5 个文件，179 个测试用例
- **边界情况测试**: 1 个文件，包含复杂场景测试
- **其他测试**: 12 个文件（基础功能、内置类型等）

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定目录的测试
npm test -- handlers/
npm test -- edge-cases/

# 运行特定文件的测试
npm test -- handlers/baseProxyHandler.test.ts

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

## 测试覆盖范围

### 核心功能

- ✅ observable 基础功能
- ✅ shadowObservable 基础功能
- ✅ observe/unobserve 响应式追踪
- ✅ 集合类型支持（Map、Set、WeakMap、WeakSet）

### 代理处理

- ✅ 基础代理操作（get、set、delete 等）
- ✅ Symbol 属性处理
- ✅ 属性描述符处理
- ✅ 原型链处理
- ✅ 构造函数代理

### 响应式系统

- ✅ 属性变化追踪
- ✅ 集合操作追踪
- ✅ 迭代操作追踪
- ✅ 多个 reactions 管理
- ✅ Reaction 清理

### 边界情况

- ✅ 非集合对象上的集合方法
- ✅ 空集合操作
- ✅ 相同值不触发
- ✅ 嵌套对象处理
- ✅ 复杂场景

## 文件重组历史

原始的四个覆盖率测试文件已被重新组织：

| 原文件                       | 新位置                  | 说明               |
| ---------------------------- | ----------------------- | ------------------ |
| coverage-complete.test.ts    | handlers/ + edge-cases/ | 边界情况和特殊场景 |
| coverage-enhancement.test.ts | handlers/               | 处理器功能测试     |
| coverage-final.test.ts       | handlers/ + edge-cases/ | 综合功能测试       |
| coverage-remaining.test.ts   | handlers/ + edge-cases/ | 分支覆盖测试       |

新的组织方式使得：

- 测试文件名清晰反映测试内容
- 相关测试集中在同一目录
- 易于维护和扩展
- 便于快速定位特定功能的测试

## 最佳实践

1. **添加新测试**: 根据测试内容放在相应的目录

   - 处理器相关 → `handlers/`
   - 边界情况 → `edge-cases/`
   - 基础功能 → 根目录

2. **命名规范**: 使用 `*.test.ts` 后缀

3. **测试组织**: 使用 `describe` 按功能分组，使用 `test` 编写具体测试

4. **覆盖率**: 保持 80% 以上的覆盖率

## 相关文档

- [observable API](../../src/observable.ts)
- [shadowObservable API](../../src/shadowObservable.ts)
- [observe API](../../src/observer.ts)
