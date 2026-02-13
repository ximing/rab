/**
 * useObserver Hook 演示页面
 * 展示如何使用 useObserver 在函数组件中追踪 observable 变化
 */
import { useObserver } from '@rabjs/react';
import { Button, Card, Space, Typography, Alert } from 'antd';

import { counterStore } from './CounterStore.js';

const { Title, Paragraph } = Typography;

// 使用 useObserver 的组件
function CounterWithHook() {
  // useObserver 接收一个渲染函数，返回渲染结果
  return useObserver(() => (
    <Card title="使用 useObserver Hook">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <strong>计数:</strong> {counterStore.count}
        </div>
        <div>
          <strong>步长:</strong> {counterStore.step}
        </div>
        <Space>
          <Button type="primary" onClick={() => counterStore.increment()}>
            +{counterStore.step}
          </Button>
          <Button onClick={() => counterStore.decrement()}>-{counterStore.step}</Button>
        </Space>
      </Space>
    </Card>
  ));
}

// 部分响应式组件 - 只有部分 UI 是响应式的
function PartialReactiveComponent() {
  // 这部分不是响应式的
  const staticContent = (
    <Alert
      message="静态内容"
      description="这部分内容不会因为 store 变化而重新渲染"
      type="info"
      style={{ marginBottom: 16 }}
    />
  );

  // 只有这部分是响应式的
  const reactiveContent = useObserver(() => (
    <Alert message="响应式内容" description={`当前计数: ${counterStore.count}`} type="success" />
  ));

  return (
    <Card title="部分响应式组件">
      {staticContent}
      {reactiveContent}
      <Paragraph type="secondary" style={{ marginTop: 16 }}>
        这个组件展示了如何只让部分 UI 成为响应式的。 只有 useObserver 包裹的部分会在 store
        变化时重新渲染。
      </Paragraph>
    </Card>
  );
}

export default function UseObserverDemo() {
  return (
    <div>
      <Title level={2}>useObserver Hook 演示</Title>
      <Paragraph>
        <code>useObserver</code> 是一个 Hook，用于在函数组件中追踪 observable 的变化。 它比{' '}
        <code>observer</code> HOC 更灵活，可以实现部分响应式渲染。
      </Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <CounterWithHook />
        <PartialReactiveComponent />

        <Card title="代码示例">
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
            {`import { useObserver } from '@rabjs/react';

function Counter() {
  return useObserver(() => (
    <div>
      <p>Count: {counterStore.count}</p>
      <button onClick={() => counterStore.increment()}>
        +1
      </button>
    </div>
  ));
}

// 部分响应式
function PartialReactive() {
  const staticPart = <div>静态内容</div>;
  
  const reactivePart = useObserver(() => (
    <div>响应式: {store.value}</div>
  ));
  
  return (
    <>
      {staticPart}
      {reactivePart}
    </>
  );
}`}
          </pre>
        </Card>
      </Space>
    </div>
  );
}
