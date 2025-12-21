/**
 * 主应用组件
 */
import { HomeOutlined, EyeOutlined, DatabaseOutlined, TeamOutlined } from '@ant-design/icons';
import { Layout, Menu, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

// 页面组件
import MinimalServiceDemo from './modules/domain/MinimalServiceDemo.js';
import UseObserverServiceDemo from './modules/domain/UseObserverServiceDemo.js';
import UseServiceDemo from './modules/domain/UseServiceDemo.js';
import MinimalObservableDemo from './modules/observer/MinimalObservableDemo.js';
import ObserverDemo from './modules/observer/ObserverDemo.js';
import TodoListDemo from './modules/observer/TodoListDemo.js';
import UseObserverDemo from './modules/observer/UseObserverDemo.js';
import ViewDemo from './modules/observer/ViewDemo.js';
import UseAsObservableSourceDemo from './modules/state/UseAsObservableSourceDemo.js';
import UseLocalObservableDemo from './modules/state/UseLocalObservableDemo.js';
import Home from './shared/Home.js';

const { Header, Content, Sider } = Layout;

// 菜单项配置
type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: <Link to="/">首页</Link>,
  },
  {
    key: 'observer-group',
    label: 'Observer 相关',
    icon: <EyeOutlined />,
    children: [
      {
        key: '/observer',
        label: <Link to="/observer">Observer 演示</Link>,
      },
      {
        key: '/minimal-observable',
        label: <Link to="/minimal-observable">最小化 observable 演示</Link>,
      },
      {
        key: '/todolist',
        label: <Link to="/todolist">TodoList 演示</Link>,
      },
      {
        key: '/use-observer',
        label: <Link to="/use-observer">useObserver 演示</Link>,
      },
      {
        key: '/view',
        label: <Link to="/view">View 演示</Link>,
      },
    ],
  },
  {
    key: 'state-group',
    label: 'State 相关',
    icon: <DatabaseOutlined />,
    children: [
      {
        key: '/use-local-observable',
        label: <Link to="/use-local-observable">useLocalObservable 演示</Link>,
      },
      {
        key: '/use-as-observable-source',
        label: <Link to="/use-as-observable-source">useAsObservableSource 演示</Link>,
      },
    ],
  },
  {
    key: 'domain-group',
    label: 'Domain & Service',
    icon: <TeamOutlined />,
    children: [
      {
        key: '/minimal-service',
        label: <Link to="/minimal-service">最小化 useService 演示</Link>,
      },
      {
        key: '/use-service',
        label: <Link to="/use-service">useService 演示</Link>,
      },
      {
        key: '/use-observer-service',
        label: <Link to="/use-observer-service">useObserverService 演示</Link>,
      },
    ],
  },
];

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>@rabjs/react 示例</div>
      </Header>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={value => setCollapsed(value)}
          width={250}
          style={{ background: colorBgContainer }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/observer" element={<ObserverDemo />} />
              <Route path="/minimal-observable" element={<MinimalObservableDemo />} />
              <Route path="/todolist" element={<TodoListDemo />} />
              <Route path="/use-observer" element={<UseObserverDemo />} />
              <Route path="/use-local-observable" element={<UseLocalObservableDemo />} />
              <Route path="/use-as-observable-source" element={<UseAsObservableSourceDemo />} />
              <Route path="/view" element={<ViewDemo />} />
              <Route path="/minimal-service" element={<MinimalServiceDemo />} />
              <Route path="/use-service" element={<UseServiceDemo />} />
              <Route path="/use-observer-service" element={<UseObserverServiceDemo />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
