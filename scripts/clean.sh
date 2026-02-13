#!/bin/bash

# 清理构建产物脚本
# 删除所有构建输出、缓存和临时文件

set -e

echo "🧹 开始清理构建产物..."

# 函数：安全删除目录（如果存在）
safe_remove() {
    if [ -d "$1" ]; then
        echo "🗑️  删除: $1"
        rm -rf "$1"
    fi
}

# 函数：递归清理workspace中的构建产物
clean_workspace_build() {
    local workspace_dir=$1
    local workspace_name=$2

    if [ ! -d "$workspace_dir" ]; then
        return
    fi

    echo "📂 清理 $workspace_name workspace..."

    for dir in "$workspace_dir"/*; do
        if [ -d "$dir" ]; then
            local pkg_name=$(basename "$dir")
            echo "  📦 清理包: $pkg_name"

            # 删除构建输出目录
            safe_remove "$dir/lib"
            safe_remove "$dir/dist"
            safe_remove "$dir/build"
            safe_remove "$dir/es"
            safe_remove "$dir/cjs"

            # 删除缓存目录
            safe_remove "$dir/.turbo"
            safe_remove "$dir/.next"
            safe_remove "$dir/.nuxt"
            safe_remove "$dir/node_modules/.cache"

            # 删除临时文件
            find "$dir" -name "*.tsbuildinfo" -delete 2>/dev/null || true
            find "$dir" -name ".DS_Store" -delete 2>/dev/null || true
        fi
    done
}

# 清理根目录缓存
echo "🗑️  清理根目录缓存..."
safe_remove ".turbo"
safe_remove "node_modules/.cache"
safe_remove ".next"
safe_remove ".nuxt"

# 清理各个workspace
clean_workspace_build "reactive-state" "reactive-state"

# 清理deprecated目录中的构建产物
# echo "📂 清理 deprecated workspace..."
# if [ -d "deprecated" ]; then
#     find deprecated -name "lib" -type d -exec rm -rf {} + 2>/dev/null || true
#     find deprecated -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
#     find deprecated -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
#     find deprecated -name "*.tsbuildinfo" -delete 2>/dev/null || true
# fi

# 清理其他临时文件
# echo "🗑️  清理临时文件..."
# find . -name "*.tsbuildinfo" -not -path "./node_modules/*" -delete 2>/dev/null || true
# find . -name ".DS_Store" -not -path "./node_modules/*" -delete 2>/dev/null || true

echo "✅ 构建产物清理完成！"
echo ""
echo "📊 清理统计："
echo "   - 已删除所有 lib/ 目录"
echo "   - 已删除所有 dist/ 目录"
echo "   - 已删除所有 .turbo/ 缓存"
echo "   - 已删除所有 *.tsbuildinfo 文件"
echo "   - 已删除所有 .DS_Store 文件"
echo ""
echo "💡 如需重新构建，请运行: pnpm build"

# 暂停1秒
sleep 1
