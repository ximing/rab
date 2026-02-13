#!/bin/bash

# 删除 node_modules 脚本
# 递归删除当前项目下及其子目录中的所有 node_modules 文件夹

set -e

echo "🧹 开始删除所有 node_modules 目录..."

# 记录删除的目录数量
deleted_count=0

# 函数：安全删除 node_modules 目录
delete_node_modules() {
    local target_dir=$1

    if [ -d "$target_dir" ]; then
        echo "🗑️  删除: $target_dir"
        rm -rf "$target_dir"
        deleted_count=$((deleted_count + 1))
    fi
}

# 删除根目录的 node_modules
delete_node_modules "./node_modules"

# 查找并删除所有子目录中的 node_modules
echo "🔍 搜索子目录中的 node_modules..."

# 使用 find 命令查找所有 node_modules 目录
# 排除根目录的 node_modules（已经删除）
# 排除 .git 目录避免搜索版本控制目录
while IFS= read -r -d '' dir; do
    # 确保不是根目录的 node_modules
    if [ "$dir" != "./node_modules" ]; then
        delete_node_modules "$dir"
    fi
done < <(find . -name "node_modules" -type d -not -path "./.git/*" -print0)

echo ""
echo "✅ node_modules 清理完成！"
echo ""
echo "📊 清理统计："
echo "   - 共删除 $deleted_count 个 node_modules 目录"
echo ""
echo "💡 如需重新安装依赖，请运行: pnpm install"
