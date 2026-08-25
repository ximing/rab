/**
 * 首页
 */
import {
  RocketOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  ApiOutlined,
  TeamOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { Card, Typography, Space, Alert, List } from 'antd';

const { Title, Paragraph } = Typography;

export default function Home() {
  const features = [
    {
      icon: <RocketOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      title: 'observer / view',
      description: '高阶组件，将组件转换为响应式组件，自动追踪 observable 变化',
    },
    {
      icon: <ThunderboltOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      title: 'useObserver',
      description: 'Hook，在函数组件中追踪 observable 变化，支持部分响应式渲染',
    },
    {
      icon: <SafetyOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      title: 'useLocalObservable',
      description: '创建组件本地的 observable 状态，支持 computed 属性',
    },
    {
      icon: <ApiOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
      title: 'useAsObservableSource',
      description: '将 props 转换为 observable，在 computed 中使用 props',
    },
    {
      icon: <TeamOutlined style={{ fontSize: 24, color: '#13c2c2' }} />,
      title: 'useService',
      description: '在 React 组件中获取服务实例，支持依赖注入和作用域链',
    },
    {
      icon: <BranchesOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
      title: 'useObserverService',
      description: '结合 useService 和 useObserver，自动追踪服务中的 observable 变化',
    },
  ];

  return (
    <div>
      <Title level={2}>@rabjs/react 示例应用</Title>

      <Alert
        message="欢迎使用响应式状态管理库"
        description="这是一个基于 @rabjs/react 的 React 响应式状态管理库，提供了类似 MobX 的 API 和使用体验。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="核心特性">
          <List
            dataSource={features}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  avatar={item.icon}
                  title={<strong>{item.title}</strong>}
                  description={item.description}
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="快速开始">
          <Paragraph>
            使用左侧菜单导航到不同的示例页面，每个页面展示了一个核心 API 的使用场景：
          </Paragraph>
          <Paragraph>
            <strong>Observer 相关:</strong>
          </Paragraph>
          <ul>
            <li>
              <strong>Observer 演示</strong> - 展示如何使用 <code>observer</code> HOC 包装函数组件
            </li>
            <li>
              <strong>useObserver 演示</strong> - 展示如何使用 <code>useObserver</code> Hook
              实现部分响应式渲染
            </li>
            <li>
              <strong>View 演示</strong> - 展示如何使用 <code>view</code> HOC 包装类组件
            </li>
          </ul>
          <Paragraph>
            <strong>State 相关:</strong>
          </Paragraph>
          <ul>
            <li>
              <strong>useLocalObservable 演示</strong> - 展示如何创建组件本地的 observable 状态
            </li>
            <li>
              <strong>useAsObservableSource 演示</strong> - 展示如何将 props 转换为 observable
            </li>
          </ul>
          <Paragraph>
            <strong>Domain & Service 相关:</strong>
          </Paragraph>
          <ul>
            <li>
              <strong>useService 演示</strong> - 展示如何在 React
              组件中获取服务实例，支持依赖注入和作用域链
            </li>
            <li>
              <strong>useObserverService 演示</strong> - 展示如何结合 useService 和
              useObserver，自动追踪服务中的 observable 变化
            </li>
            <li>
              <strong>嵌套 Domain 演示</strong> - 展示如何使用嵌套 Domain 和作用域链来管理服务
            </li>
          </ul>
        </Card>

        <Card title="技术栈">
          <Space direction="vertical">
            <div>
              <strong>核心库:</strong> @rabjs/react
            </div>
            <div>
              <strong>UI 框架:</strong> Ant Design 6.x
            </div>
            <div>
              <strong>路由:</strong> React Router 7.x
            </div>
            <div>
              <strong>构建工具:</strong> Vite 7.x
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
