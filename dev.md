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
