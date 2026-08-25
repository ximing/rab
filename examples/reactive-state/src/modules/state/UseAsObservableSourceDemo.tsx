/**
 * useAsObservableSource Hook 演示页面
 * 展示如何使用 useAsObservableSource 将 props 转换为 observable
 */
import { observer, useAsObservableSource, useLocalObservable } from '@rabjs/react';
import { Card, Select, Space, Typography, Descriptions, Tag, Alert } from 'antd';
import { useState } from 'react';

import { userStore } from './UserStore.js';

const { Title, Paragraph } = Typography;

// 用户详情组件 - 使用 useAsObservableSource 将 props 转换为 observable
interface UserProfileProps {
  userId: number;
  userName: string;
}

const UserProfile = observer(({ userId, userName }: UserProfileProps) => {
  // 将 props 转换为 observable
  const observableProps = useAsObservableSource({ userId, userName });

  // 创建本地状态，可以在 computed 中使用 observableProps
  const state = useLocalObservable(() => ({
    get displayName() {
      return `用户: ${observableProps.userName} (ID: ${observableProps.userId})`;
    },
    get userInfo() {
      return userStore.users.find(u => u.id === observableProps.userId);
    },
    get isAdmin() {
      return this.userInfo?.role === 'admin';
    },
  }));

  return (
    <Card title="用户资料">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert message={state.displayName} type={state.isAdmin ? 'success' : 'info'} showIcon />

        {state.userInfo && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ID">{state.userInfo.id}</Descriptions.Item>
            <Descriptions.Item label="姓名">{state.userInfo.name}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{state.userInfo.email}</Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag color={state.isAdmin ? 'red' : 'blue'}>
                {state.userInfo.role === 'admin' ? '管理员' : '普通用户'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}

        <Paragraph type="secondary">
          这个组件使用 <code>useAsObservableSource</code> 将 props 转换为 observable， 然后在
          computed 属性中使用这些 props。当 props 变化时，computed 会自动重新计算。
        </Paragraph>
      </Space>
    </Card>
  );
});

// 带有计算属性的表单组件
interface FormWithComputedProps {
  firstName: string;
  lastName: string;
}

const FormWithComputed = observer(({ firstName, lastName }: FormWithComputedProps) => {
  const observableProps = useAsObservableSource({ firstName, lastName });

  const state = useLocalObservable(() => ({
    prefix: '先生/女士',

    get fullName() {
      return `${observableProps.firstName} ${observableProps.lastName}`;
    },

    get displayName() {
      return `${this.fullName} ${this.prefix}`;
    },

    get nameLength() {
      return this.fullName.length;
    },

    setPrefix(prefix: string) {
      this.prefix = prefix;
    },
  }));

  return (
    <Card title="姓名计算">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="名">{firstName}</Descriptions.Item>
          <Descriptions.Item label="姓">{lastName}</Descriptions.Item>
          <Descriptions.Item label="全名">{state.fullName}</Descriptions.Item>
          <Descriptions.Item label="显示名称">{state.displayName}</Descriptions.Item>
          <Descriptions.Item label="名字长度">{state.nameLength}</Descriptions.Item>
        </Descriptions>

        <Space>
          <span>称谓:</span>
          <Select
            value={state.prefix}
            onChange={value => state.setPrefix(value)}
            style={{ width: 120 }}
            options={[
              { value: '先生', label: '先生' },
              { value: '女士', label: '女士' },
              { value: '博士', label: '博士' },
              { value: '教授', label: '教授' },
            ]}
          />
        </Space>
      </Space>
    </Card>
  );
});

export default function UseAsObservableSourceDemo() {
  const [selectedUserId, setSelectedUserId] = useState(1);
  const [firstName, setFirstName] = useState('张');
  const [lastName, setLastName] = useState('三');

  const selectedUser = userStore.users.find(u => u.id === selectedUserId);

  return (
    <div>
      <Title level={2}>useAsObservableSource Hook 演示</Title>
      <Paragraph>
        <code>useAsObservableSource</code> 用于将 props 或其他值转换为 observable 对象。 这在需要在
        computed 属性中使用 props 时非常有用。
      </Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 用户选择器 */}
        <Card title="选择用户">
          <Space>
            <span>选择用户:</span>
            <Select
              value={selectedUserId}
              onChange={setSelectedUserId}
              style={{ width: 200 }}
              options={userStore.users.map(u => ({
                value: u.id,
                label: u.name,
              }))}
            />
          </Space>
        </Card>

        {/* 用户资料 */}
        {selectedUser && <UserProfile userId={selectedUser.id} userName={selectedUser.name} />}

        {/* 姓名表单 */}
        <Card title="姓名输入">
          <Space>
            <span>名:</span>
            <Select
              value={firstName}
              onChange={setFirstName}
              style={{ width: 100 }}
              options={[
                { value: '张', label: '张' },
                { value: '李', label: '李' },
                { value: '王', label: '王' },
              ]}
            />
            <span>姓:</span>
            <Select
              value={lastName}
              onChange={setLastName}
              style={{ width: 100 }}
              options={[
                { value: '三', label: '三' },
                { value: '四', label: '四' },
                { value: '五', label: '五' },
              ]}
            />
          </Space>
        </Card>

        <FormWithComputed firstName={firstName} lastName={lastName} />

        {/* 代码示例 */}
        <Card title="代码示例">
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
            {`import { observer, useAsObservableSource, useLocalObservable } from '@rabjs/react';

const UserProfile = observer(({ userId, userName }) => {
  // 将 props 转换为 observable
  const observableProps = useAsObservableSource({ userId, userName });

  // 在 computed 中使用 observableProps
  const state = useLocalObservable(() => ({
    get displayName() {
      return \`用户: \${observableProps.userName} (ID: \${observableProps.userId})\`;
    },
    get userInfo() {
      return userStore.users.find(u => u.id === observableProps.userId);
    }
  }));

  return (
    <div>
      <h3>{state.displayName}</h3>
      {state.userInfo && (
        <div>
          <p>邮箱: {state.userInfo.email}</p>
          <p>角色: {state.userInfo.role}</p>
        </div>
      )}
    </div>
  );
});`}
          </pre>
        </Card>
      </Space>
    </div>
  );
}
