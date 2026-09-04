#!/bin/bash

# 发布脚本
# 在发布时临时使用 .mnpmrc 配置，发布完成后恢复

set -e

echo "🚀 开始发布到npm..."
# 清理产物
echo "🧹 清理产物..."
pnpm run clean

# 构建项目
echo "🏗️  构建项目..."
pnpm build

# 发布门禁：完整测试层（含放大的属性测试 RAB_PROPERTY_RUNS）必须全绿。
# 与日常 test 同一批用例，release 层把差分属性测试的随机序列数放大到 2000，
# 组合空间扫描更深；cache 关闭，不得以缓存结果通过门禁。
echo "🧪 执行发布前完整测试层..."
pnpm test:release

# 执行发布前检查
echo "🔍 执行发布前检查..."
node scripts/publish-check.cjs

# 发布。Changesets v3 不再接受 --ignore-scripts；各包也没有 prepublishOnly。
echo "📦 发布包..."
pnpm changeset publish

echo "✅ 发布完成！"

echo "🎉 发布流程完成！"
