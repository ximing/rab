import { CodeBlock } from "../../components/CodeBlock";

const installCode = `# skill 源文件在 rab 仓库的 ai/skills/rab-react/ 下
git clone git@github.com:ximing/rab.git

# 方式一：全局安装（所有项目生效）
cp -r rab/ai/skills/rab-react ~/.claude/skills/

# 方式二：项目级安装（只对当前项目生效，可随仓库分发给团队）
cp -r rab/ai/skills/rab-react your-project/.claude/skills/`;

const frontmatterCode = `---
name: rab-react
description: React响应式状态管理库，用于 \`@rabjs/react\` 包的 React
  响应式开发指导。当用户提到 \`@rabjs/react\`、响应式组件、\`RSRoot\`、
  \`RSStrict\`、\`observer\`、\`view\`、\`useService\`、\`useObserver\`、
  \`bindServices\`、Service 注入、可观察状态管理或相关页面改造时，
  应优先使用这个 skill。
---`;

const dialogueCode = `你：帮我写一个购物车组件，能加商品、算总价，数据从 /api/cart 加载。

Claude（触发 rab-react skill 后）：
  - 创建 CartService extends Service：
      items / total（getter 计算属性）/ async loadCart()
  - 组件用 observer 包裹，useService(CartService) 取实例，
    通过 service.$model.loadCart.loading 渲染加载态
  - 最后 bindServices(CartPage, [CartService]) 导出
  - 不会解构 service.items（避免破坏响应性），
    不会把页面级 Service 用 register 全局注册`;

/**
 * rab-react Skill（路由 /ai/skill-rab-react）
 *
 * 内容以仓库 ai/skills/rab-react/SKILL.md 及 references/ 为准。
 */
export default function SkillRabReact() {
  return (
    <div>
      <h1>rab-react Skill</h1>
      <p>
        <code>rab-react</code> 是一个 Claude Code skill，源文件在仓库{" "}
        <code>ai/skills/rab-react/</code> 下。它把 <code>@rabjs/react</code>{" "}
        的核心用法、生命周期规则和常见错误整理成 AI 友好的参考文档，让 Claude
        在写 RAB 代码时按正确约定生成，而不是凭空编造 API。
      </p>

      <h2>安装</h2>
      <CodeBlock language="bash">{installCode}</CodeBlock>
      <p>
        安装后无需手动调用——skill 的 frontmatter 声明了触发场景，当对话涉及
        RAB 开发时 Claude 会自动加载：
      </p>
      <CodeBlock language="yaml" title="SKILL.md frontmatter（节选）">
        {frontmatterCode}
      </CodeBlock>

      <h2>SKILL.md 覆盖什么</h2>
      <p>主文件聚焦五大核心概念，每个都附带正确/错误对照示例：</p>
      <ol>
        <li>
          <strong>响应式组件</strong>：<code>observer</code> / <code>view</code>
          包裹组件才能自动追踪状态；不要解构 observable。
        </li>
        <li>
          <strong>Service</strong>：属性自动 observable、方法自动 action、
          异步方法通过 <code>$model.methodName</code> 追踪 loading / error。
        </li>
        <li>
          <strong>useService + bindServices</strong>
          ：注册与获取服务，容器与组件生命周期绑定。
        </li>
        <li>
          <strong>生命周期</strong>：全局单例用 <code>register()</code>（禁止{" "}
          <code>bindServices</code>），页面/组件级用 <code>bindServices()</code>。
        </li>
        <li>
          <strong>Service 之间的关系</strong>：getter + <code>resolve()</code>{" "}
          取依赖、作用域链规则（只能访问父级与全局）、<code>@Inject</code>{" "}
          装饰器注入。
        </li>
      </ol>
      <p>
        此外还包含「快速诊断」（组件不更新 / useService 报错 / 依赖报错）和一套
        推荐的目录结构（services / pages / components 三层）。
      </p>

      <h2>references 清单</h2>
      <p>
        进阶主题拆在 <code>references/</code> 下，SKILL.md 会在需要时引导 AI
        去查阅：
      </p>
      <ul>
        <li>
          <code>async-operations.md</code> — 异步操作与状态追踪：{" "}
          <code>$model</code>、loading、error 详解。
        </li>
        <li>
          <code>computed-properties.md</code> — 计算属性与缓存：getter、
          <code>@Memo</code> 装饰器。
        </li>
        <li>
          <code>event-system.md</code> — 事件系统：容器级事件、全局事件、
          <code>emit</code> / <code>on</code> / <code>off</code>。
        </li>
        <li>
          <code>decorators.md</code> — 装饰器：<code>@Inject</code>、
          <code>@Debounce</code>、<code>@Throttle</code>、<code>@On</code> 等。
        </li>
        <li>
          <code>hooks-api.md</code> — Hooks API：<code>useObserver</code>、
          <code>useLocalObservable</code>、<code>useReaction</code> 等。
        </li>
        <li>
          <code>domain-architecture.md</code> — 领域架构：多级嵌套、作用域链、
          跨领域通信。
        </li>
        <li>
          <code>observable-api.md</code> — Observable API：
          <code>observable</code>、<code>raw</code>、<code>observe</code>、
          <code>unobserve</code>。
        </li>
        <li>
          <code>ssr.md</code> — SSR 支持：<code>enableStaticRendering</code>。
        </li>
        <li>
          <code>debugging.md</code> — 调试技巧：常见问题和解决方案。
        </li>
        <li>
          <code>best-practices.md</code> — 最佳实践：代码组织、性能优化。
        </li>
      </ul>

      <h2>evals：skill 如何被评估</h2>
      <p>
        <code>evals/evals.json</code> 里有 10 组评估用例，覆盖计数器、异步用户
        列表、全局 vs 页面级注册、Service 依赖与作用域、常见错误诊断、装饰器、
        领域架构、Hooks、事件系统、计算属性等场景。每组用例给出 prompt 和 3-5
        条断言（例如「使用了 observer」「没有解构 observable」「是否引导查看
        参考文档」），用于回归验证 skill 的引导质量；详见{" "}
        <code>evals/README.md</code>。
      </p>

      <h2>装上之后怎么问</h2>
      <CodeBlock language="text" title="示例对话">
        {dialogueCode}
      </CodeBlock>
    </div>
  );
}
