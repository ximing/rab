import { bindServices, observer, useService } from "@rabjs/react";
import { CounterService } from "./CounterService";

/**
 * 计数器 live demo —— 首页和 Demo 集合页共用。
 *
 * 三段式写法（全站 demo 统一约定）：
 * 1. 定义 Service（见 CounterService.ts）；
 * 2. observer 包装组件，useService 取实例；
 * 3. bindServices 导出，为组件提供独立的服务容器。
 */
const Counter = observer(() => {
  const counter = useService(CounterService);
  return (
    <div className="demo-row">
      <button className="demo-btn" onClick={() => counter.decrement()}>
        -1
      </button>
      <span className="demo-count">{counter.count}</span>
      <button className="demo-btn primary" onClick={() => counter.increment()}>
        +1
      </button>
    </div>
  );
});

export default bindServices(Counter, [CounterService]);
