/**
 * 最小化 useService Demo - 用于调试 observer + useService 的问题
 *
 * 这个 demo 展示了一个最简单的场景：
 * 1. 定义一个简单的 Service
 * 2. 使用 observer HOC 包装组件
 * 3. 在组件中使用 useService 获取服务实例
 * 4. 观察数据变化是否触发重新渲染
 */

import { Service } from '@rabjs/react';
import { bindServices, useService, observer } from '@rabjs/react';
import { Button, Card, Space, Alert } from 'antd';

/**
 * 最小化 Service - 只有一个计数器
 */
class CounterService extends Service {
  count: number = 0;

  increment() {
    this.count++;
    console.log('CounterService.increment() called, count =', this.count);
  }

  decrement() {
    debugger;
    this.count--;
    console.log('CounterService.decrement() called, count =', this.count);
  }

  reset() {
    this.count = 0;
    console.log('CounterService.reset() called, count =', this.count);
  }
}

/**
 * 显示计数器的组件 - 使用 observer 包装
 *
 * 问题：当 counterService.count 变化时，这个组件是否会重新渲染？
 */
// const CounterDisplay = observer(() => {
//   const counterService = useService(CounterService);
//   return (
//     <Card title="计数器显示" size="small">
//       <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
//         Count: {counterService.count}
//       </div>
//       <Alert
//         message="观察控制台输出"
//         description="当点击按钮时，观察控制台是否输出 'CounterDisplay render'。如果没有输出，说明组件没有重新渲染。"
//         type="info"
//         showIcon
//       />
//     </Card>
//   );
// });

/**
 * 控制计数器的组件 - 使用 observer 包装
 */
// const CounterControls = observer(() => {
//   const counterService = useService(CounterService);
//   (window as any).counterService = counterService;
//   console.log('count', counterService.count);

//   return (
//     <Card title="计数器控制" size="small">
//       <div> Count: {counterService.count}</div>
//       <Space>
//         <Button
//           type="primary"
//           onClick={() => {
//             console.log('Before increment, count =', counterService.count);
//             counterService.increment();
//             console.log('After increment, count =', counterService.count);
//           }}
//         >
//           +1
//         </Button>
//         <Button
//           onClick={() => {
//             console.log('Before decrement, count =', counterService.count);
//             counterService.decrement();
//             console.log('After decrement, count =', counterService.count);
//           }}
//         >
//           -1
//         </Button>
//         <Button
//           danger
//           onClick={() => {
//             console.log('Before reset, count =', counterService.count);
//             counterService.reset();
//             console.log('After reset, count =', counterService.count);
//           }}
//         >
//           Reset
//         </Button>
//       </Space>
//     </Card>
//   );
// });

/**
 * 主组件 - 展示计数器
 */
const MinimalServiceDemoContent = () => {
  const counterService = useService(CounterService);
  (window as any).counterService = counterService;
  //   console.log('count', counterService.count);

  return (
    <div style={{ padding: 24 }}>
      <Card title="计数器控制" size="small">
        <div> Count: {counterService.count}</div>
        <Space>
          <Button
            type="primary"
            onClick={() => {
              counterService.increment();
            }}
          >
            +1
          </Button>
          <Button
            onClick={() => {
              counterService.decrement();
            }}
          >
            -1
          </Button>
          <Button
            danger
            onClick={() => {
              counterService.reset();
            }}
          >
            Reset
          </Button>
        </Space>
      </Card>
    </div>
  );
};

/**
 * 导出包装后的组件
 *
 * bindServices 会：
 * 1. 创建一个新的容器
 * 2. 在容器中注册 CounterService
 * 3. 返回一个包装后的组件，该组件会通过 DomainContext 提供容器
 */
export default bindServices(MinimalServiceDemoContent, [CounterService]);
