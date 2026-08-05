import { CodeBlock } from "../../components/CodeBlock";
import { DemoCard } from "../../components/DemoCard";
import CollabDemo, { collabDemoCode } from "../../demos/collab";
import ServiceScopeDemo, {
  serviceScopeDemoCode,
} from "../../demos/service-scope";

const serviceBaseCode = `import { Service } from "@rabjs/react";

class UserService extends Service {
  name = "";
  profile: Profile | null = null;

  // 同步方法：默认就是 Action，多次赋值合并成一次渲染
  setName(name: string) {
    this.name = name;
  }

  // 异步方法：$model.loadProfile 自动维护 loading / error
  async loadProfile(id: number) {
    this.profile = await fetchProfile(id);
  }
}

// 实例还有两个基类自带的成员：
// - instanceId: string  实例唯一标识（如 "UserService#0"），容器实例化后回写
// - $model             每个方法的 { loading, error } 状态，类型随子类方法自动推导`;

const syncActionCode = `import { Service, SyncAction } from "@rabjs/react";

class DraftService extends Service {
  text = "";

  // 高频输入时不想要批量调度，可以用 @SyncAction 排除
  @SyncAction
  onInput(text: string) {
    this.text = text;
  }
}`;

const containerCode = `import { bindServices } from "@rabjs/react";

// bindServices(组件, [服务...], { name? }) 做了三件事：
// 1. 新建一个 Container，父节点是上层 bindServices 的容器（最顶层是全局容器）
// 2. 把列表里的 Service 注册进这个容器（默认 singleton：一个容器一份实例）
// 3. 通过 Context 提供给子树，useService 沿组件树向上查找解析

export default bindServices(Page, [UserService, TodoService]);

// 嵌套 bindServices 时，子容器先在自己里面找，找不到就向父容器委托，
// 一直到全局容器 —— 所以「全局共享的服务」放在上层注册即可。`;

const globalCode = `import { register, resolve, has, getGlobalContainer } from "@rabjs/react";

// 不进 React 组件树也能用：直接操作全局容器
register(UserService);                    // 注册到全局容器
register("userService", UserService);     // 用自定义标识符（字符串 / Symbol）
has(UserService);                         // 是否已注册
const user = resolve(UserService);        // 解析（首次解析时才实例化）
getGlobalContainer();                     // 拿到全局容器本身`;

/**
 * Service 服务容器 / 依赖注入（路由 /guides/service）
 */
export default function Service() {
  return (
    <div>
      <h1>Service 服务容器</h1>
      <p>
        Service 是组织状态和业务的单位，Container 负责创建、缓存和组装它们。
        这一页讲清楚这两层各自做了什么。
      </p>

      <h2>Service 基类</h2>
      <p>
        继承 <code>Service</code> 后免费得到三件事：所有属性变成响应式
        （构造时实例被 <code>observable()</code> 包装）、所有方法默认是 Action、
        每个方法自动附带 <code>$model</code> 里的 loading/error 状态：
      </p>
      <CodeBlock language="ts" title="UserService.ts">{serviceBaseCode}</CodeBlock>
      <p>
        基类还自带事件方法（<code>on / once / off / emit</code>）和{" "}
        <code>resolve()</code>（从所属容器解析依赖服务），以及{" "}
        <code>destroy()</code>（清理事件监听、Debounce/Throttle 定时器、Memo 缓存）。
      </p>

      <h3>@Action 与 @SyncAction</h3>
      <p>
        方法默认就是 Action，<code>@Action</code> 写了也只是个标记（可读性）。
        真正有意义的是反向的 <code>@SyncAction</code>——把某个方法排除出批量更新：
      </p>
      <CodeBlock language="ts">{syncActionCode}</CodeBlock>

      <h2>服务间依赖：getter + this.resolve</h2>
      <p>
        一个 Service 要用另一个 Service，推荐写成 getter +
        <code>this.resolve()</code>：<code>resolve</code> 从当前实例所属的容器解析依赖，
        容器内 singleton 缓存保证每次拿到同一个实例。依赖关系是显式的普通代码，
        类型也由返回值直接推导：
      </p>
      <p>
        注意：<code>resolve</code> 只能解析到同一容器树里的服务——被依赖的 Service
        必须和当前 Service 注册在同一个 <code>bindServices</code> 列表里，
        或注册在上层容器 / 全局容器中（子容器解析不到时会沿父链向上委托）。
      </p>
      <DemoCard
        title="getter + this.resolve 解析依赖"
        description="GreetingService 依赖 SettingsService，bindServices 把两者注册进同一个容器"
        code={collabDemoCode}
      >
        <CollabDemo />
      </DemoCard>
      <p>
        <code>@Inject</code> 属性装饰器仍然可用（首次访问时懒解析并缓存，
        标识符支持类 / 字符串 / Symbol），但 getter 模式更显式、类型推导更直接，
        新代码建议用 getter 写法。
      </p>

      <h2>Container 与 bindServices</h2>
      <p>
        容器持有「标识符 → 服务定义」的注册表，负责实例化和缓存。React 里你不直接
        new 容器，而是用 <code>bindServices</code> 把它绑到组件树上：
      </p>
      <CodeBlock language="tsx">{containerCode}</CodeBlock>
      <p>
        应用根部想要一个统一入口时，可以用 <code>RSRoot</code>——它就是{" "}
        <code>bindServices(children, [])</code>，一个空注册表的顶层容器。
      </p>
      <DemoCard
        title="嵌套 Service 与全局 Service"
        description="观察父子容器解析、同级实例隔离，以及全局容器注册与解析"
        code={serviceScopeDemoCode}
      >
        <ServiceScopeDemo />
      </DemoCard>

      <h2>实例化时机与生命周期</h2>
      <ul>
        <li>
          注册不等于实例化：<code>bindServices</code> 挂载时只创建容器和注册表，
          Service 实例在第一次 <code>useService</code> / <code>resolve</code> 时才创建。
        </li>
        <li>
          默认 singleton：同一个容器里多次解析拿到同一实例，所以同组件树内状态天然共享。
        </li>
        <li>
          组件卸载时容器随之销毁（内部用 FinalizationRegistry 兜底，
          避免 concurrent 模式下泄漏），实例的 <code>destroy()</code> 会被调用来清理资源。
        </li>
        <li>
          每个实例有唯一的 <code>instanceId</code>（如 <code>CounterService#0</code>），
          调试和 DevTools 都靠它定位实例。
        </li>
      </ul>

      <h2>脱离 React 使用容器</h2>
      <p>
        <code>@rabjs/service</code> 本身不依赖 React，脚本、Node 环境都可以直接用全局容器：
      </p>
      <CodeBlock language="ts">{globalCode}</CodeBlock>
      <p>
        需要更细的粒度时也可以 <code>new Container({`{ name, parent }`})</code> 手动建容器树，
        API 与 bindServices 内部用的是同一套。
      </p>
    </div>
  );
}
