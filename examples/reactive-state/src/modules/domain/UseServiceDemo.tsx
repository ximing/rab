/**
 * useService Hook 演示
 *
 * 展示如何在 React 组件中使用 useService Hook 获取服务实例
 * 结合 observer HOC 实现自动响应式更新
 *
 * 关键点：
 * 1. useService 获取服务实例
 * 2. 服务实例与 Provider 的生命周期一致
 * 3. 多个组件获取同一个服务时，得到的是同一个实例
 * 4. 使用 observer HOC 包装组件以自动追踪 observable 变化
 * 5. bindServices 为组件提供服务容器
 */

import { UserAddOutlined, DeleteOutlined } from '@ant-design/icons';
import { bindServices, useService, observer } from '@rabjs/react';
import { Card, Button, Space, List, Tag, Empty, Spin, Alert, Divider, Row, Col } from 'antd';

import type { User } from './UserService';
import { UserService } from './UserService';

/**
 * 用户列表组件 - 使用 observer HOC 包装以自动追踪响应式更新
 *
 * observer 会自动追踪组件中访问的所有 observable 属性
 * 当这些属性变化时，组件会自动重新渲染
 */
const UserList = observer(() => {
  const userService = useService(UserService);
  (window as any).a = userService;
  return (
    <Card title="用户列表" size="small">
      {userService.loading ? (
        <Spin />
      ) : userService.error ? (
        <Alert message={userService.error} type="error" showIcon />
      ) : userService.users.length === 0 ? (
        <Empty description="暂无用户" />
      ) : (
        <List
          dataSource={userService.users}
          renderItem={(user: User) => (
            <List.Item
              key={user.id}
              actions={[
                <Button type="text" size="small" onClick={() => userService.setCurrentUser(user)}>
                  选择
                </Button>,
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => userService.removeUser(user.id)}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={<span style={{ fontSize: 24 }}>{user.avatar}</span>}
                title={user.name}
                description={user.email}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
});

/**
 * 当前用户显示组件 - 使用 observer HOC 包装
 *
 * 当 userService.currentUser 变化时，组件会自动重新渲染
 */
const CurrentUserDisplay = observer(() => {
  const userService = useService(UserService);

  if (!userService.currentUser) {
    return (
      <Card title="当前用户" size="small">
        <Empty description="未选择用户" />
      </Card>
    );
  }

  const user = userService.currentUser;

  return (
    <Card title="当前用户" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <strong>ID:</strong> {user.id}
        </div>
        <div>
          <strong>名称:</strong> {user.name}
        </div>
        <div>
          <strong>邮箱:</strong> {user.email}
        </div>
        <Button block danger onClick={() => userService.clearCurrentUser()}>
          清除选择
        </Button>
      </Space>
    </Card>
  );
});

/**
 * 用户操作组件 - 展示如何通过 useService 调用服务方法
 *
 * newUserName 现在是服务中的 observable 属性
 * 当用户输入时，服务中的 newUserName 会自动更新
 * observer 会自动追踪这个属性的变化并重新渲染组件
 */
const UserOperations = observer(() => {
  const userService = useService(UserService);
  (window as any).b = userService;

  return (
    <Card title="用户操作" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <strong>用户总数:</strong> {userService.users.length}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="输入新用户名"
            value={userService.newUserName}
            onChange={e => userService.setNewUserName(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && userService.addNewUser()}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
            }}
          />
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => userService.addNewUser()}
          >
            添加用户
          </Button>
        </div>
      </Space>
    </Card>
  );
});

/**
 * 服务信息组件 - 展示服务实例的信息
 *
 * 展示服务的各种状态信息
 */
const ServiceInfo = observer(() => {
  const userService = useService(UserService);

  return (
    <Card title="服务信息" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <strong>服务类型:</strong> <Tag>UserService</Tag>
        </div>
        <div>
          <strong>当前用户:</strong>{' '}
          {userService.currentUser ? (
            <Tag color="blue">{userService.currentUser.name}</Tag>
          ) : (
            <Tag>未选择</Tag>
          )}
        </div>
        <div>
          <strong>加载状态:</strong>{' '}
          {userService.loading ? (
            <Tag color="processing">加载中</Tag>
          ) : (
            <Tag color="success">就绪</Tag>
          )}
        </div>
        <div>
          <strong>错误信息:</strong>{' '}
          {userService.error ? (
            <Tag color="error">{userService.error}</Tag>
          ) : (
            <Tag color="success">无</Tag>
          )}
        </div>
      </Space>
    </Card>
  );
});

/**
 * 主组件 - 使用 bindServices 提供 UserService
 *
 * bindServices 会：
 * 1. 为组件创建一个独立的容器
 * 2. 在容器中注册指定的服务
 * 3. 通过 DomainContext 将容器传递给子组件
 * 4. 使用 view HOC 包装组件以支持响应式更新
 */
const UseServiceDemoContent = () => {
  return (
    <div>
      <Alert
        message="useService Hook 演示"
        description="useService 用于在 React 组件中获取服务实例。服务实例与 Provider 的生命周期一致，多个组件获取同一个服务时得到的是同一个实例。使用 observer HOC 包装组件以自动追踪响应式更新。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <UserList />
            <UserOperations />
          </Space>
        </Col>
        <Col xs={24} sm={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <CurrentUserDisplay />
            <ServiceInfo />
          </Space>
        </Col>
      </Row>

      <Divider />

      <Card title="关键概念" size="small">
        <ul>
          <li>
            <strong>bindServices:</strong> 为组件创建独立的服务容器，注册指定的服务
          </li>
          <li>
            <strong>useService:</strong> 在 Provider 作用域内获取服务实例
          </li>
          <li>
            <strong>单例模式:</strong> 同一个 Provider 中的服务实例是单例的
          </li>
          <li>
            <strong>生命周期绑定:</strong> 服务实例与 Provider 的生命周期一致
          </li>
          <li>
            <strong>observer HOC:</strong> 自动追踪组件中访问的 observable
            属性，属性变化时自动重新渲染
          </li>
          <li>
            <strong>作用域链:</strong> 子 Provider 可以访问父 Provider 中的服务
          </li>
          <li>
            <strong>Service 基类:</strong> 所有属性自动 observable，所有方法默认都是 Action
          </li>
        </ul>
      </Card>

      <Divider />

      <Card title="最佳实践" size="small">
        <ul>
          <li>
            <strong>使用 observer 包装组件:</strong> 确保组件能够自动追踪 observable 变化
          </li>
          <li>
            <strong>在服务中定义业务逻辑:</strong> 将状态和方法都定义在 Service 中
          </li>
          <li>
            <strong>使用 useService 获取服务:</strong> 而不是直接创建服务实例
          </li>
          <li>
            <strong>避免在组件中直接修改服务状态:</strong> 通过服务方法修改状态
          </li>
          <li>
            <strong>使用 TypeScript:</strong> 获得更好的类型检查和开发体验
          </li>
        </ul>
      </Card>
    </div>
  );
};

/**
 * 导出包装后的组件
 *
 * bindServices 会：
 * 1. 创建一个新的容器
 * 2. 在容器中注册 UserService
 * 3. 返回一个包装后的组件，该组件会通过 DomainContext 提供容器
 */
export default bindServices(UseServiceDemoContent, [UserService]);
