#!/bin/bash

# 版本升级脚本
# 1. 显示待发布的变更集状态
# 2. 等待用户确认
# 3. 执行版本升级
# 4. 自动提交变更

set -e

echo "📊 检查待发布的变更集状态..."
echo ""

# 执行 changeset status 并显示详细信息
npx changeset status --verbose

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 等待用户确认
read -p "❓ 确认以上变更集信息无误，继续执行版本升级？(y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消版本升级"
    exit 1
fi

echo ""
echo "🔄 开始执行版本升级..."
echo ""

# 执行版本升级
npx changeset version

echo ""
echo "✅ 版本升级完成！"
echo ""

# 检查是否有变更需要提交
if [[ -z $(git status --porcelain) ]]; then
    echo "ℹ️  没有需要提交的变更"
    exit 0
fi

echo "📝 准备提交变更..."
echo ""

# 显示变更的文件
echo "变更的文件："
git status --short

echo ""
read -p "❓ 是否自动提交这些变更？(y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "ℹ️  已跳过自动提交，请手动提交变更"
    exit 0
fi

# 添加所有变更
git add .

# 提交变更
COMMIT_MSG="chore: version packages"
git commit -m "$COMMIT_MSG"

echo ""
echo "✅ 变更已提交！"
echo ""
echo "📌 提交信息: $COMMIT_MSG"
echo ""
echo "💡 提示: 请使用 'git push' 推送变更到远程仓库"
echo ""
echo "🎉 版本升级流程完成！"
