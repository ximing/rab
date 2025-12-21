/**
 * 最小化 observable + observer Demo - 用于调试 observable 和 observer 的问题
 *
 * 这个 demo 展示了一个最简单的场景：
 * 1. 使用 observable 创建响应式对象
 * 2. 使用 observer HOC 包装组件
 * 3. 在组件中访问 observable 对象的属性
 * 4. 观察数据变化是否触发重新渲染
 */

import { observable, observer } from '@rabjs/react';
import { Button, Card, Space, Alert } from 'antd';

/**
 * 最小化 Store - 使用 observable 创建响应式对象
 */
const counterState = observable({
  count: 0,

  increment() {
    this.count++;
    console.log('counterState.increment() called, count =', this.count);
  },

  decrement() {
    debugger;
    this.count--;
    console.log('counterState.decrement() called, count =', this.count);
  },

  reset() {
    this.count = 0;
    console.log('counterState.reset() called, count =', this.count);
  },
});

/**
 * 显示计数器的组件 - 使用 observer 包装
 *
 * 问题：当 counterState.count 变化时，这个组件是否会重新渲染？
 */
const CounterDisplay = observer(() => {
  console.log('CounterDisplay render');

  return (
    <Card title="计数器显示" size="small">
      <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Count: {counterState.count}
      </div>
      <Alert
        message="观察控制台输出"
        description="当点击按钮时，观察控制台是否输出 'CounterDisplay render'。如果没有输出，说明组件没有重新渲染。"
        type="info"
        showIcon
      />
    </Card>
  );
});

/**
 * 控制计数器的组件 - 使用 observer 包装
 */
const CounterControls = observer(() => {
  console.log('CounterControls render');

  return (
    <Card title="计数器控制" size="small">
      <Space>
        <Button
          type="primary"
          onClick={() => {
            console.log('Before increment, count =', counterState.count);
            counterState.increment();
            console.log('After increment, count =', counterState.count);
          }}
        >
          +1
        </Button>
        <Button
          onClick={() => {
            console.log('Before decrement, count =', counterState.count);
            counterState.decrement();
            console.log('After decrement, count =', counterState.count);
          }}
        >
          -1
        </Button>
        <Button
          danger
          onClick={() => {
            console.log('Before reset, count =', counterState.count);
            counterState.reset();
            console.log('After reset, count =', counterState.count);
          }}
        >
          Reset
        </Button>
      </Space>
    </Card>
  );
});

/**
 * 主组件 - 展示计数器
 */
const MinimalObservableDemoContent = () => {
  return (
    <div style={{ padding: 24 }}>
      <Alert
        message="最小化 observable + observer Demo"
        description="这个 demo 用于调试 observable 和 observer 的问题。打开浏览器控制台，观察当点击按钮时是否输出 'CounterDisplay render' 和 'CounterControls render'。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <CounterDisplay />
        <CounterControls />

        <Card title="调试说明" size="small">
          <ul>
            <li>
              <strong>预期行为：</strong> 点击按钮后，计数器显示应该更新，控制台应该输出
              'CounterDisplay render'
            </li>
            <li>
              <strong>实际行为：</strong> 如果计数器显示没有更新，说明 observer HOC 没有正确追踪
              observable 的变化
            </li>
            <li>
              <strong>原因分析：</strong> observer 使用 useObserver Hook 来追踪 observable
              的访问，当 observable 属性变化时应该触发重新渲染
            </li>
            <li>
              <strong>对比 Service：</strong> 这个 demo 使用 observable
              直接创建响应式对象，而不是通过 Service 和 useService Hook
            </li>
          </ul>
        </Card>

        <Card title="代码对比" size="small">
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 12 }}>
            <strong>使用 observable 的方式：</strong>
            <pre style={{ margin: '8px 0', fontSize: 12 }}>
              {`const counterState = observable({
  count: 0,
  increment() { this.count++; }
});

const Counter = observer(() => {
  return <div>{counterState.count}</div>;
});`}
            </pre>
          </div>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            <strong>使用 Service 的方式：</strong>
            <pre style={{ margin: '8px 0', fontSize: 12 }}>
              {`class CounterService extends Service {
  count = 0;
  increment() { this.count++; }
}

const Counter = observer(() => {
  const service = useService(CounterService);
  return <div>{service.count}</div>;
});`}
            </pre>
          </div>
        </Card>
      </Space>
    </div>
  );
};

/**
 * 导出组件
 */
export default MinimalObservableDemoContent;
