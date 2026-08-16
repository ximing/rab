import { CodeBlock } from "../../components/CodeBlock";

const installCode = `# 安装方式见「AI 用法总览」的安装章节（支持 Claude Code / Codex /
# Cursor / Grok / Kimi / OpenCode / Pi），通用兜底：
cp -r rab/skills/rab-rn-debug ~/.claude/skills/`;

const setupCode = `# 1. 电脑上启动调试服务（打印的局域网 IP 供手机连接）
npx rab-rn-debug            # 默认端口 9229

# 2. RN 应用入口集成 SDK（仅 __DEV__ 生效）
pnpm add @rabjs/rn-debug`;

const setupSdkCode = `import { setupRNDebug } from '@rabjs/rn-debug';

setupRNDebug({ host: '<电脑局域网IP>', port: 9229, appName: 'MyApp' });`;

const devicesCode = `curl -s http://localhost:9229/api/devices
# 期望: [{"deviceId":"rn-ios-xxxx","appName":"MyApp","platform":"ios",
#         "connectedAt":...,"lastSeen":...}]`;

const commandCode = `curl -X POST http://localhost:9229/api/commands \\
  -H 'Content-Type: application/json' \\
  -d '{"type":"<指令type>","payload":{...},"timeout":30000}'

# 响应（请求同步挂起，直到设备执行完毕）：
# {"id":"...","status":"ok","result":{...},"durationMs":42}`;

const flowCode = `# 1. 连通性检查
{"type":"ping"}

# 2. 枚举所有已实例化的 Service
{"type":"rab.listServices"}
# → [{ "instanceId": "CartService#1", "identifierLabel": "CartService", ... }]

# 3. 读取 Service 状态（identifierLabel 或 instanceId 二选一）
{"type":"rab.getServiceState","payload":{"identifierLabel":"CartService"}}

# 4. 调用方法（含异步，必须用 instanceId 定位）
{"type":"rab.callServiceMethod","payload":{
  "instanceId":"CartService#1","method":"addItem",
  "args":[{"id":"test-1","name":"Test","price":9.9}]}}

# 5. 断言验证（rab.expect）
{"type":"rab.expect","payload":{
  "instanceId":"CartService#1","description":"加购后状态验证",
  "assertions":[
    {"op":"eq","path":"items.length","expected":1},
    {"op":"gt","path":"total","expected":0}]}}

# 6. 拉取设备 console 日志
{"type":"console.getLogs","payload":{"level":"error","limit":20}}`;

const promptCode = `你：帮我验证一下 RN 购物车页的加购逻辑：调用 CartService 的
    addItem 加一件商品，然后确认 items.length 变成 1、total 大于 0。
    手机已经连上调试服务了。

Agent（触发 rab-rn-debug skill 后）：
  1. GET /api/devices 确认设备在线（必要时 ping）
  2. rab.listServices 找到 CartService 的 instanceId
  3. rab.getServiceState 记录初始状态（items.length === 0）
  4. rab.callServiceMethod 调用 addItem(...)
  5. rab.expect 断言 items.length === 1、total > 0
  6. console.getLogs 检查有无异常日志`;

/**
 * rab-rn-debug Skill（路由 /ai/skill-rn-debug）
 *
 * 内容以仓库 skills/rab-rn-debug/SKILL.md 为准。
 */
export default function SkillRnDebug() {
  return (
    <div>
      <h1>rab-rn-debug Skill</h1>
      <p>
        <code>rab-rn-debug</code> 是一个跨编程工具的 Agent skill，源文件在仓库{" "}
        <code>skills/rab-rn-debug/</code> 下。它教 AI 助手通过本地调试服务
        （<code>@rabjs/rn-debug-server</code>）向集成了{" "}
        <code>@rabjs/rn-debug</code> SDK 的 React Native 应用发送 HTTP 指令，
        对真机 / 模拟器上的 Service 层做功能验证与状态检查：枚举 Service、读
        状态、调方法、跑断言、拉日志。
      </p>

      <h2>工作原理</h2>
      <p>
        电脑上运行一个本地服务（默认 <code>localhost:9229</code>），Agent 通过
        HTTP 向它发送结构化指令；RN 端 SDK 用 WebSocket 长连接接收指令，按设备
        严格串行执行后回传结果；Agent 的 HTTP 请求同步挂起直到结果中转返回。
        服务自带一个调试页面（浏览器打开 <code>http://localhost:9229</code>），
        可以查看设备在线状态与指令收发时间线。
      </p>

      <h2>前置条件</h2>
      <ol>
        <li>
          电脑上启动调试服务，RN 应用入口集成 SDK（仅 <code>__DEV__</code>{" "}
          生效，release 构建自动 no-op）：
          <CodeBlock language="bash">{setupCode}</CodeBlock>
          <CodeBlock language="ts" title="App 入口">{setupSdkCode}</CodeBlock>
        </li>
        <li>
          确认设备在线（手机与电脑需在同一网段；Android 模拟器访问宿主机用{" "}
          <code>10.0.2.2</code> 而非 localhost）：
          <CodeBlock language="bash">{devicesCode}</CodeBlock>
        </li>
        <li>安装 skill 本身（支持各编程工具，见总览页）：</li>
      </ol>
      <CodeBlock language="bash">{installCode}</CodeBlock>

      <h2>指令调用方式</h2>
      <p>
        唯一设备在线时自动路由；多设备返回 409（从 body 的{" "}
        <code>devices</code> 数组选一个，改用{" "}
        <code>POST /api/devices/&lt;deviceId&gt;/commands</code>）；无设备返回
        404。默认超时 30s（上限 120s）。
      </p>
      <CodeBlock language="bash">{commandCode}</CodeBlock>

      <h2>典型验证流程</h2>
      <p>skill 约定了一套六步流程（在线确认 → 枚举 → 快照 → 操作 → 断言 → 日志）：</p>
      <CodeBlock language="json" title="指令 payload 序列">{flowCode}</CodeBlock>
      <p>
        断言 op 与 <code>@rabjs/devtools</code> 的 RSExpectBuilder 语义一致
        （<code>eq</code>、<code>gt</code>、<code>exists</code>、
        <code>includes</code>、<code>matchObject</code>、<code>some</code>{" "}
        等 20 余种），<code>path</code> 支持点号路径深入嵌套属性。
      </p>

      <h2>示例 prompt</h2>
      <CodeBlock language="text">{promptCode}</CodeBlock>

      <h2>常见问题（skill 内置）</h2>
      <ul>
        <li>
          设备列表为空：手机与电脑不在同一网段，或 <code>host</code> 填错（用
          server 启动时打印的 IP）；App 为 release 构建（SDK 仅{" "}
          <code>__DEV__</code> 生效）。
        </li>
        <li>
          <code>rab.listServices</code> 看不到某个 Service：仅 Singleton 作用域
          且已实例化的 Service 会被枚举；Transient 不缓存实例，不会出现。
        </li>
        <li>
          指令返回 timeout：加大 <code>timeout</code>（上限 120s）；或设备已
          掉线，先查 <code>/api/devices</code>。
        </li>
      </ul>
    </div>
  );
}
