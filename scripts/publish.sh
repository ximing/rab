# 1. 确保代码最新
git pull origin master

# 2. 创建变更集
pnpm changeset

# 3. 提交变更集
git add .changeset
git commit -m "chore: add changeset"

# 4. 版本提升
pnpm version-packages

# 5. 提交版本变更
git add .
git commit -m "chore: version packages"

# 6. 发布
pnpm run publish:mnmp

# 7. 推送到远程
git push origin master --follow-tags

