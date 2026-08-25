/**
 * Observer HOC 演示页面
 * 展示如何使用 observer 包装函数组件
 */
import { PlusOutlined, MinusOutlined, ReloadOutlined } from '@ant-design/icons';
import { observer } from '@rabjs/react';
import { Button, Card, Space, Statistic, Typography } from 'antd';

import { counterStore } from './CounterStore.js';

const { Title, Paragraph } = Typography;

// 使用 observer 包装的函数组件
const Counter = observer(() => {
  return (
    <Card title="计数器" style={{ marginBottom: 16 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Statistic title="当前计数" value={counterStore.count} valueStyle={{ color: '#3f8600' }} />

        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => counterStore.increment()}>
            增加 {counterStore.step}
          </Button>
          <Button icon={<MinusOutlined />} onClick={() => counterStore.decrement()}>
            减少 {counterStore.step}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => counterStore.reset()}>
            重置
          </Button>
        </Space>

        <Space>
          <span>步长:</span>
          {[1, 2, 5, 10].map(step => (
            <Button
              key={step}
              type={counterStore.step === step ? 'primary' : 'default'}
              onClick={() => counterStore.setStep(step)}
            >
              {step}
            </Button>
          ))}
        </Space>
      </Space>
    </Card>
  );
});

// 另一个 observer 组件 - 展示多个组件可以共享同一个 store
const CounterDisplay = observer(() => {
  return (
    <Card title="计数器显示（共享状态）">
      <Paragraph>
        当前计数: <strong>{counterStore.count}</strong>
      </Paragraph>
      <Paragraph>
        当前步长: <strong>{counterStore.step}</strong>
      </Paragraph>
      <Paragraph type="secondary">
        这个组件和上面的计数器共享同一个 store，当任何一个组件修改数据时， 两个组件都会自动更新。
      </Paragraph>
    </Card>
  );
});

export default function ObserverDemo() {
  return (
    <div>
      <Title level={2}>Observer HOC 演示</Title>
      <Paragraph>
        <code>observer</code> 是一个高阶组件（HOC），用于将函数组件转换为响应式组件。 当组件中访问的
        observable 数据发生变化时，组件会自动重新渲染。
      </Paragraph>

      <Counter />
      <CounterDisplay />

      <Card title="代码示例" style={{ marginTop: 16 }}>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
          {`import { observer } from '@rabjs/react';
import { counterStore } from './CounterStore';

const Counter = observer(() => {
  return (
    <div>
      <p>Count: {counterStore.count}</p>
      <button onClick={() => counterStore.increment()}>
        +1
      </button>
    </div>
  );
});`}
        </pre>
      </Card>
    </div>
  );
}
