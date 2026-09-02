# 环境

NodeJS >= 22
pnpm >= 10

# 安装依赖

pnpm install

# 调试 CLI

## 动态添加 pnpm 全局 bin 目录到 PATH

```bash
echo "export PATH=\"$(pnpm root -g)/.bin:\$PATH\"" >> ~/.zshrc
source ~/.zshrc
```

## 全局 link 命令行

```bash
pnpm run link:global
```

## 使用命令

```bash
o --help
```

# 测试分层

| 层     | 命令                | 内容                                                                  | 时机                                                                           |
| ------ | ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 日常层 | `pnpm test:turbo`   | 全部单元/集成测试 + 差分属性测试（100 组随机序列）+ 内存浸泡          | 日常开发、CI                                                                   |
| 发布层 | `pnpm test:release` | 同上，但差分属性测试放大到 `RAB_PROPERTY_RUNS=2000`，turbo cache 关闭 | **发包门禁**（`scripts/publish-npm.sh` 在 build 之后强制执行，不过则中止发布） |

- 差分属性测试（`packages/observer/src/__tests__/differential.property.test.ts`）：
  fast-check 生成随机操作序列，observable 与普通对象/集合参照逐步比对状态、
  reaction 派生值与通知次数模型。失败时 fast-check 会自动 shrink 出最小反例。
- 内存浸泡（`memory-soak.test.ts(x)`）：不等 GC 的确定性断言 —— 组件
  mount/unmount、observe/unobserve、Service create/destroy 循环后，
  connectionStore 订阅数必须回到基线，残留即泄漏。
