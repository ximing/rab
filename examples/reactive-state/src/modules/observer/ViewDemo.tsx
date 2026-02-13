/**
 * view HOC 演示页面
 * 展示如何使用 view 包装类组件和函数组件
 */
import { view } from '@rabjs/react';
import { Button, Card, Space, Typography, Statistic, Row, Col } from 'antd';
import { Component } from 'react';

import { counterStore } from './CounterStore.js';

const { Title, Paragraph } = Typography;

// 类组件 - 使用 view 包装
class ClassCounter extends Component {
  render() {
    return (
      <Card title="类组件计数器">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic title="计数" value={counterStore.count} />
            </Col>
            <Col span={12}>
              <Statistic title="步长" value={counterStore.step} />
            </Col>
          </Row>

          <Space>
            <Button type="primary" onClick={() => counterStore.increment()}>
              增加
            </Button>
            <Button onClick={() => counterStore.decrement()}>减少</Button>
            <Button onClick={() => counterStore.reset()}>重置</Button>
          </Space>

          <Paragraph type="secondary">
            这是一个使用 <code>view</code> 包装的类组件。 当 observable
            数据变化时，组件会自动重新渲染。
          </Paragraph>
        </Space>
      </Card>
    );
  }
}

// 使用 view 包装类组件
const ReactiveClassCounter = view(ClassCounter);

// 带有生命周期的类组件
class ClassWithLifecycle extends Component {
  componentDidMount() {
    console.log('ClassWithLifecycle mounted');
  }

  componentWillUnmount() {
    console.log('ClassWithLifecycle will unmount');
  }

  shouldComponentUpdate(nextProps: any, nextState: any) {
    console.log('ClassWithLifecycle shouldComponentUpdate');
    return true;
  }

  render() {
    return (
      <Card title="带生命周期的类组件">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <strong>当前计数:</strong> {counterStore.count}
          </div>
          <div>
            <strong>当前步长:</strong> {counterStore.step}
          </div>

          <Paragraph type="secondary">
            这个类组件有完整的生命周期方法。<code>view</code> 会正确处理这些生命周期，
            并在组件卸载时自动清理 reaction。打开控制台查看生命周期日志。
          </Paragraph>
        </Space>
      </Card>
    );
  }
}

const ReactiveClassWithLifecycle = view(ClassWithLifecycle);

// 带有 state 的类组件
class ClassWithState extends Component<{}, { localCount: number }> {
  state = {
    localCount: 0,
  };

  incrementLocal = () => {
    this.setState(prev => ({ localCount: prev.localCount + 1 }));
  };

  render() {
    return (
      <Card title="带本地 State 的类组件">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic title="全局计数 (Observable)" value={counterStore.count} />
            </Col>
            <Col span={12}>
              <Statistic title="本地计数 (State)" value={this.state.localCount} />
            </Col>
          </Row>

          <Space>
            <Button type="primary" onClick={() => counterStore.increment()}>
              增加全局计数
            </Button>
            <Button onClick={this.incrementLocal}>增加本地计数</Button>
          </Space>

          <Paragraph type="secondary">
            这个组件同时使用了 observable 状态和本地 state。
            <code>view</code> 可以正确处理两种状态的更新。
          </Paragraph>
        </Space>
      </Card>
    );
  }
}

const ReactiveClassWithState = view(ClassWithState);

// 函数组件 - view 也支持函数组件（内部使用 observer）
const FunctionCounter = view(() => {
  return (
    <Card title="函数组件（使用 view）">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <strong>计数:</strong> {counterStore.count}
        </div>
        <div>
          <strong>步长:</strong> {counterStore.step}
        </div>

        <Paragraph type="secondary">
          <code>view</code> 也可以用于函数组件，内部会自动使用 <code>observer</code>。
          推荐函数组件直接使用 <code>observer</code>，类组件使用 <code>view</code>。
        </Paragraph>
      </Space>
    </Card>
  );
});

export default function ViewDemo() {
  return (
    <div>
      <Title level={2}>view HOC 演示</Title>
      <Paragraph>
        <code>view</code> 是一个高阶组件（HOC），主要用于将类组件转换为响应式组件。
        它也支持函数组件，但函数组件推荐直接使用 <code>observer</code>。
      </Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <ReactiveClassCounter />
        <ReactiveClassWithLifecycle />
        <ReactiveClassWithState />
        <FunctionCounter />

        <Card title="代码示例">
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
            {`import { view } from '@rabjs/react';
import { Component } from 'react';

// 类组件
class Counter extends Component {
  render() {
    return (
      <div>
        <p>Count: {counterStore.count}</p>
        <button onClick={() => counterStore.increment()}>
          +1
        </button>
      </div>
    );
  }
}

// 使用 view 包装
const ReactiveCounter = view(Counter);

// 带生命周期的类组件
class CounterWithLifecycle extends Component {
  componentDidMount() {
    console.log('mounted');
  }

  componentWillUnmount() {
    console.log('unmounting');
  }

  render() {
    return <div>{counterStore.count}</div>;
  }
}

const ReactiveCounterWithLifecycle = view(CounterWithLifecycle);

// 函数组件（也支持，但推荐使用 observer）
const FuncCounter = view(() => {
  return <div>{counterStore.count}</div>;
});`}
          </pre>
        </Card>
      </Space>
    </div>
  );
}
