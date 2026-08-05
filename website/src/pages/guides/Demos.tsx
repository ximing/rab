import { DemoCard } from "../../components/DemoCard";
import CounterDemo, { counterDemoCode } from "../../demos/counter";
import TodoDemo, { todoDemoCode } from "../../demos/todo";
import AsyncUserDemo, { asyncUserDemoCode } from "../../demos/async-user";
import CollabDemo, { collabDemoCode } from "../../demos/collab";

/**
 * 在线 Demo 集合（路由 /guides/demos）
 * 每个 demo 的 live 组件都在 src/demos/<name>/ 下，页面只做引用。
 */
export default function Demos() {
  return (
    <div>
      <h1>在线 Demo</h1>
      <p>
        全部是可以直接点的真实示例，源码用的就是发布包的 API。每个 demo 都有独立的
        服务容器，互不影响。
      </p>

      <DemoCard
        title="计数器"
        description="Service + observer + useService 的最小组合"
        code={counterDemoCode}
      >
        <CounterDemo />
      </DemoCard>

      <DemoCard
        title="Todo 列表"
        description="增删改查 + getter 实现 computed 过滤（filteredTodos / remaining）"
        code={todoDemoCode}
      >
        <TodoDemo />
      </DemoCard>

      <DemoCard
        title="异步加载"
        description="async 方法的 loading / error 由 $model 自动维护，直接渲染即可"
        code={asyncUserDemoCode}
      >
        <AsyncUserDemo />
      </DemoCard>

      <DemoCard
        title="服务协作"
        description="GreetingService 通过 getter + this.resolve 读取 SettingsService，跨服务的 computed 自动更新"
        code={collabDemoCode}
      >
        <CollabDemo />
      </DemoCard>
    </div>
  );
}
