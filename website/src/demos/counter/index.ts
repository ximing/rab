import CounterDemo from "./CounterDemo";

export default CounterDemo;
export { CounterService } from "./CounterService";

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 CounterService / CounterDemo 时同步更新这里的字符串。
 */
export const counterDemoCode = `import { Action, Service } from "@rabjs/react";
import { bindServices, observer, useService } from "@rabjs/react";

// 1. 定义 Service：属性自动 observable，方法自动 Action
class CounterService extends Service {
  count = 0;

  @Action
  increment() {
    this.count += 1;
  }

  @Action
  decrement() {
    this.count -= 1;
  }
}

// 2. observer 包装组件，useService 获取服务实例
const Counter = observer(() => {
  const counter = useService(CounterService);
  return <button onClick={() => counter.increment()}>{counter.count}</button>;
});

// 3. bindServices 为组件提供服务容器
export default bindServices(Counter, [CounterService]);
`;
