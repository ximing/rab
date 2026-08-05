# 双语 README 与 AI First 项目定位设计

## 目标

重写仓库首页文档，使 RAB 清晰表达为面向 AI 时代的响应式状态管理架构；提供中文和英文两份可切换 README；增加一张仓库内静态 SVG 架构图；同步更新 GitHub About 的 description、homepage 和 topics。

## 文档结构

- `README.md`：英文主文档，面向国际用户、GitHub 访客和 AI Agent。
- `README.zh-CN.md`：完整中文文档。
- 两份文档顶部互相链接，使用 `English | 简体中文` 切换。
- 两份文档共享同一组章节和代码示例，避免中英文内容失配。

README 章节固定为：

1. 项目标题、徽章和双语切换
2. 一句话定位与 AI First 核心论点
3. 静态 SVG 架构图
4. 为什么 RAB 适合 AI 时代
5. 核心架构：Observer、Service、React、DevTools、Web MCP
6. 快速开始
7. 核心 API 示例
8. 人与 AI 共享同一份状态的工作流
9. 包与项目结构
10. 文档、开发、测试、构建和贡献
11. License

内容重点从传统的“功能清单”改为解释状态模型：状态由 Service/Observable 统一承载；React UI、DevTools 和 Web MCP 都通过同一响应式状态层读写；AI 不需要操作 UI 像素或维护第二套状态镜像，而是通过可枚举的 Service、Action 和工具协议参与应用。

## SVG 视觉资产

新增 `docs/assets/ai-first-state.svg`，使用纯 SVG 绘制三层结构：

- 左侧 Human：React UI、用户操作、开发者工具；
- 中央 Shared Reactive State：Observable、Service Container、Action/Events；
- 右侧 AI：Agent、Web MCP、Skills；
- 中央状态层向 UI 和 AI 双向连接，突出“人和 AI 读写同一份状态”。

SVG 使用仓库 Signal 设计系统中的青色/琥珀色/深色语义，不依赖外部图片服务，不新增构建依赖。README 使用相对路径引用，GitHub 和本地预览都可显示。

## GitHub About

通过 `gh repo edit ximing/rab` 更新：

- description：突出 AI-first reactive state architecture、Service、Observer、React、DevTools、Web MCP；
- homepage：指向仓库的 GitHub Pages 文档站；
- topics：加入 `ai-first`、`state-management`、`react`、`typescript`、`reactive-programming`、`service-container`、`web-mcp` 等主题。

如果 GitHub API 或网络不可用，README 和 SVG 仍可本地完成；About 更新结果必须明确报告，不得假称成功。

## 验证

- 检查两个 README 的双语切换链接、SVG 相对路径和 Markdown 代码块。
- 运行 `pnpm --filter @rabjs/website build`，确认文档站不受 README/资产变化影响。
- 使用 `git diff --check` 检查空白问题。
- 使用 `gh repo view ximing/rab --json description,homepageUrl,repositoryTopics` 回读 GitHub About；网络不可用时记录实际错误。
