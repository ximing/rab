#!/bin/bash

# 美团内网发布脚本
# 在发布时临时使用 .mnpmrc 配置，发布完成后恢复

set -e

echo "🚀 开始发布到美团内网npm..."
# 清理产物
echo "🧹 清理产物..."
pnpm run clean

# 构建项目
echo "🏗️  构建项目..."
pnpm build

# 执行发布前检查
echo "🔍 执行发布前检查..."
node scripts/publish-check.cjs

# 备份当前的 .npmrc
if [ -f ~/.npmrc ]; then
    echo "📋 备份当前 .npmrc 配置..."
    cp ~/.npmrc ~/.npmrc.backup
fi

# 临时使用 .mnpmrc 配置
echo "🔧 使用 .mnpmrc 配置..."
cp ~/.mnpmrc ~/.npmrc

# 发布（跳过 prepublishOnly 钩子，因为已经构建过了）
echo "📦 发布包..."
pnpm changeset publish --ignore-scripts

echo "✅ 发布完成！"

# 恢复原来的 .npmrc
if [ -f ~/.npmrc.backup ]; then
    echo "🔄 恢复原来的 .npmrc 配置..."
    mv ~/.npmrc.backup ~/.npmrc
else
    echo "🗑️  删除临时 .npmrc 配置..."
    rm ~/.npmrc
fi

echo "🎉 发布流程完成！"
