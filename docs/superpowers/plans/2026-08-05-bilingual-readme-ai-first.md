# Bilingual README and AI First Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 RAB 的中英文 README，加入 AI First 状态管理架构图，并通过 `gh repo edit` 更新 GitHub About。

**Architecture:** `README.md` 作为英文主文档，`README.zh-CN.md` 提供完整中文镜像，两者顶部互相链接并共享同一信息架构。`docs/assets/ai-first-state.svg` 是无外部依赖的静态视觉资产，表达 Human/UI 与 AI/Tools 通过同一 Shared Reactive State 协作；GitHub About 使用仓库文档站地址、AI First 描述和可发现性 topics。

**Tech Stack:** Markdown, inline code examples, SVG, GitHub CLI (`gh repo edit`), existing pnpm/Vite website build.

## Global Constraints

- `README.md`：英文主文档，面向国际用户、GitHub 访客和 AI Agent。
- `README.zh-CN.md`：完整中文文档。
- 两份文档顶部互相链接，使用 `English | 简体中文` 切换。
- README 使用相对路径引用 `docs/assets/ai-first-state.svg`。
- SVG 使用纯 SVG 绘制，不依赖外部图片服务，不新增构建依赖。
- 内容重点从传统的“功能清单”改为解释状态模型：状态由 Service/Observable 统一承载；React UI、DevTools 和 Web MCP 都通过同一响应式状态层读写；AI 不需要操作 UI 像素或维护第二套状态镜像，而是通过可枚举的 Service、Action 和工具协议参与应用。
- GitHub About 更新失败时必须报告实际错误，不得假称成功。

---

## 文件结构

- Modify: `README.md` — 英文主文档，完整介绍定位、架构、快速开始、API、AI 工作流和开发方式。
- Create: `README.zh-CN.md` — 与英文 README 章节对应的中文文档。
- Create: `docs/assets/ai-first-state.svg` — Human / Shared Reactive State / AI 三层架构图。
- External: GitHub repository About for `ximing/rab` — description, homepage, topics via `gh`.

### Task 1: Create the AI First architecture SVG

**Files:**
- Create: `docs/assets/ai-first-state.svg`

**Interfaces:**
- Produces a self-contained SVG that can be rendered from Markdown with `![RAB AI First architecture](docs/assets/ai-first-state.svg)`.
- Visual labels include `Human`, `Shared Reactive State`, `AI`, `React UI`, `DevTools`, `Observable`, `Service Container`, `Actions / Events`, `Agent`, `Web MCP`, and `Skills`.

- [ ] **Step 1: Create a 1200×560 SVG with accessible title/description and repository Signal colors.**

Use this structure: dark rounded background; left amber Human panel; centered cyan state panel; right cyan/blue AI panel; two-way arrows from each side to the center; small footer text `One state surface · many operators`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 560" role="img" aria-labelledby="title desc">
  <title id="title">RAB AI First reactive state architecture</title>
  <desc id="desc">Human interfaces and AI tools read and write the same observable service state.</desc>
  <rect width="1200" height="560" rx="28" fill="#10141c"/>
  <!-- Human, Shared Reactive State, and AI panels with labeled nodes and bidirectional connectors. -->
  <text x="600" y="520" text-anchor="middle" fill="#8b96a8" font-family="Arial, sans-serif" font-size="16">One state surface · many operators</text>
</svg>
```

The final SVG must replace the comment with concrete `<g>`, `<rect>`, `<text>`, `<path>` and arrow marker elements; keep all text as SVG text so GitHub’s image renderer exposes the concept without external fonts or assets.

- [ ] **Step 2: Validate the SVG structure and relative path target.**

Run: `rg -n '<svg|<title|<desc|Shared Reactive State|Human|AI|Observable|Service Container|Web MCP|Skills' docs/assets/ai-first-state.svg`

Expected: one SVG root, title and description, all required labels, and no external `href`, image URL, or script.

- [ ] **Step 3: Run whitespace validation.**

Run: `git diff --check -- docs/assets/ai-first-state.svg`

Expected: no output and exit 0.

- [ ] **Step 4: Commit the asset.**

```bash
git add docs/assets/ai-first-state.svg
git commit -m "docs: add AI first state architecture graphic"
```

### Task 2: Rewrite the English README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes `docs/assets/ai-first-state.svg` through a repository-relative Markdown image path.
- Produces the English canonical project narrative and API examples.

- [ ] **Step 1: Replace the existing README with the approved section structure.**

Include these exact top-level sections and content responsibilities:

```markdown
# RAB — AI-First Reactive State Architecture

[English](./README.md) | [简体中文](./README.zh-CN.md)

> A reactive state architecture where humans and AI agents operate on the same observable state surface.

![RAB AI First architecture](docs/assets/ai-first-state.svg)

## Why RAB
## Architecture
## Quick Start
## Core Packages
## The AI-First Workflow
## Service Example
## Observer Example
## Web MCP and DevTools
## Repository Structure
## Development
## Documentation
## Contributing
## License
```

Describe the architecture in plain language: `@rabjs/observer` tracks dependencies and reactions; `@rabjs/service` provides observable Service instances, containers, lifecycle, actions and method models; `@rabjs/react` connects those services to React; DevTools and Web MCP expose the same container/state surface to inspection and agent operations.

- [ ] **Step 2: Add a correct minimal React Service example.**

Use the current API conventions, including no obsolete `@Injectable` requirement and no unnecessary `@Action` decoration:

```tsx
import { Service, bindServices, observer, useService } from "@rabjs/react";

class CounterService extends Service {
  count = 0;

  increment() {
    this.count += 1;
  }
}

const Counter = observer(() => {
  const counter = useService(CounterService);
  return <button onClick={() => counter.increment()}>{counter.count}</button>;
});

export default bindServices(Counter, [CounterService]);
```

Explain that Service properties are observable by default, methods are Actions by default, and `bindServices` creates a scoped container with lazy singleton resolution.

- [ ] **Step 3: Explain AI First as a state contract rather than an AI UI feature.**

Document this flow in prose and a compact code example:

```text
Human click / Agent tool call
        ↓
Service action or explicit state mutation
        ↓
Observable dependency tracking
        ↓
React UI, DevTools, and assertions observe the same update
```

State that this reduces duplicated client/server/UI mirrors, makes operations inspectable, and gives coding agents stable names and boundaries to reason about.

- [ ] **Step 4: Add accurate setup, package table, docs links, development commands, contribution rules, and MIT license links.**

Use the repository’s actual commands (`pnpm install`, `pnpm build`, `pnpm test:turbo`, `pnpm --filter @rabjs/website build`) and link the docs site to `https://ximing.github.io/rab/`.

- [ ] **Step 5: Check the English README for stale APIs and broken links.**

Run: `rg -n "Injectable|container\.get|@Action|<repository-url>|mnmp|80%" README.md`

Expected: no stale examples or placeholder repository URLs remain.

- [ ] **Step 6: Commit the English README.**

```bash
git add README.md
git commit -m "docs: rewrite README around AI first architecture"
```

### Task 3: Create the Chinese README mirror

**Files:**
- Create: `README.zh-CN.md`

**Interfaces:**
- Consumes the same SVG path and project facts as `README.md`.
- Produces a complete Chinese document with the same top-level sections and code behavior.

- [ ] **Step 1: Translate the canonical structure without reducing technical detail.**

Use the heading mapping:

```text
Why RAB             → 为什么选择 RAB
Architecture        → 核心架构
Quick Start         → 快速开始
Core Packages       → 核心包
The AI-First Workflow → AI First 工作流
Service Example     → Service 示例
Observer Example    → Observer 示例
Web MCP and DevTools → Web MCP 与 DevTools
Repository Structure → 仓库结构
Development         → 开发
Documentation       → 文档
Contributing        → 贡献
License             → 许可证
```

Keep API names, package names, code blocks and command lines identical to the English document; translate surrounding explanations into concise Chinese.

- [ ] **Step 2: Add reciprocal language links and the same relative SVG reference.**

The first lines must include:

```markdown
[English](./README.md) | [简体中文](./README.zh-CN.md)
...
![RAB AI First 架构](docs/assets/ai-first-state.svg)
```

- [ ] **Step 3: Validate parity and links.**

Run: `rg -n '^#|README\.zh-CN\.md|README\.md|docs/assets/ai-first-state\.svg|@rabjs/(observer|service|react|web-mcp)' README.md README.zh-CN.md`

Expected: both files have matching section counts, reciprocal links, the SVG path, and all core package references.

- [ ] **Step 4: Commit the Chinese README.**

```bash
git add README.zh-CN.md
git commit -m "docs: add Chinese README"
```

### Task 4: Update GitHub About with gh

**Files:**
- External: GitHub About for `ximing/rab`

**Interfaces:**
- Uses authenticated `gh` CLI against `origin` repository `ximing/rab`.
- Sets description, homepage, and discoverability topics.

- [ ] **Step 1: Confirm authentication and repository identity.**

Run: `gh auth status; gh repo view ximing/rab --json nameWithOwner,description,homepageUrl,repositoryTopics`

Expected: authenticated account has permission to administer the repository; if not, stop and report the exact error before attempting mutation.

- [ ] **Step 2: Update About metadata.**

Run:

```bash
gh repo edit ximing/rab \
  --description "AI-first reactive state architecture for React and TypeScript — shared observable state for humans, agents, DevTools, and Web MCP." \
  --homepage "https://ximing.github.io/rab/" \
  --add-topic ai-first \
  --add-topic state-management \
  --add-topic reactive-programming \
  --add-topic react \
  --add-topic typescript \
  --add-topic service-container \
  --add-topic web-mcp
```

- [ ] **Step 3: Read back About metadata.**

Run: `gh repo view ximing/rab --json description,homepageUrl,repositoryTopics,url`

Expected: description and homepage match the requested values; topics contain all seven requested topics. If the command fails because the environment cannot reach GitHub, preserve the local README changes and report About as not updated.

### Task 5: Final validation

**Files:**
- Verify: `README.md`
- Verify: `README.zh-CN.md`
- Verify: `docs/assets/ai-first-state.svg`
- Verify: `website/src/pages/Home.tsx`

- [ ] **Step 1: Validate Markdown references and stale content.**

Run: `rg -n "README\.zh-CN\.md|docs/assets/ai-first-state\.svg|Injectable|container\.get|<repository-url>|mnmp" README.md README.zh-CN.md`

Expected: reciprocal language links and SVG references are present; stale API and placeholder matches are absent.

- [ ] **Step 2: Run repository formatting/whitespace checks.**

Run: `git diff --check`

Expected: exit 0 with no output.

- [ ] **Step 3: Build the documentation site.**

Run: `pnpm --filter @rabjs/website build`

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 4: Verify the final GitHub state or record the network blocker.**

Run: `gh repo view ximing/rab --json description,homepageUrl,repositoryTopics`

Expected: the About values match, or the exact network/authentication error is included in the final report.

- [ ] **Step 5: Commit all local documentation changes.**

```bash
git add README.md README.zh-CN.md docs/assets/ai-first-state.svg
git commit -m "docs: add bilingual AI-first project README"
```
