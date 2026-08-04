/**
 * Service 继承核心验证 - 极简版本
 * 验证加减操作在各种继承组合下的响应式是否正确
 */

import { Service, bindServices, useService, observer } from "@rabjs/react";
import { Button, Card, Space, Typography, Tag, Divider } from "antd";

const { Title, Text } = Typography;

// ============================================================
// 1. 无继承的基础服务
// ============================================================
export class BasicService extends Service {
  count = 0;

  increment() {
    this.count++;
  }
}

// ============================================================
// 2. 有继承的父服务
// ============================================================
export class ParentService extends Service {
  parentCount = 0;
  sharedCount = 0;

  incrementParent() {
    this.parentCount++;
  }

  incrementShared() {
    this.sharedCount += 10;
  }
}

// ============================================================
// 3. 有继承的子服务
// ============================================================
export class ChildService extends ParentService {
  childCount = 0;

  // 新增自己的方法
  incrementChild() {
    this.childCount++;
  }

  // 重写父类的方法
  override incrementShared() {
    this.sharedCount += 100; // 重写：每次加 100 而不是 10
  }
}

// ============================================================
// 组件部分
// ============================================================

const InheritanceDemoContent = observer(() => {
  const basic = useService(BasicService);
  const child = useService(ChildService);

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <Title level={4}>Service 继承极简验证</Title>

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* 对照组：无继承 */}
        <Card title="1. 对照组：无继承的基础 Service" size="small">
          <div style={{ marginBottom: 16 }}>
            <Text>基础数字：</Text>
            <Tag color="blue" style={{ fontSize: 16, padding: "2px 8px" }}>
              {basic.count}
            </Tag>
          </div>
          <Button type="primary" onClick={() => basic.increment()}>
            基础加一 (basic.increment)
          </Button>
        </Card>

        {/* 实验组：有继承 */}
        <Card title="2. 实验组：有继承的子 Service" size="small">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            
            {/* 场景 A：子类调用父类属性和父类方法 */}
            <div>
              <div style={{ marginBottom: 8 }}>
                <Text strong>场景 A：调用父类方法修改父类属性</Text>
                <Tag color="green" style={{ fontSize: 16, margin: "0 8px" }}>
                  {child.parentCount}
                </Tag>
              </div>
              <Button onClick={() => child.incrementParent()}>
                父类加一 (child.incrementParent)
              </Button>
            </div>

            <Divider style={{ margin: "12px 0" }} />

            {/* 场景 B：子类调用子类属性和子类方法 */}
            <div>
              <div style={{ marginBottom: 8 }}>
                <Text strong>场景 B：调用子类自身方法修改子类属性</Text>
                <Tag color="orange" style={{ fontSize: 16, margin: "0 8px" }}>
                  {child.childCount}
                </Tag>
              </div>
              <Button onClick={() => child.incrementChild()}>
                子类加一 (child.incrementChild)
              </Button>
            </div>

            <Divider style={{ margin: "12px 0" }} />

            {/* 场景 C：子类重写父类方法 */}
            <div>
              <div style={{ marginBottom: 8 }}>
                <Text strong>场景 C：调用重写方法修改继承属性</Text>
                <Tag color="purple" style={{ fontSize: 16, margin: "0 8px" }}>
                  {child.sharedCount}
                </Tag>
              </div>
              <Button onClick={() => child.incrementShared()}>
                重写方法加一百 (child.incrementShared)
              </Button>
            </div>

          </Space>
        </Card>
      </Space>
    </div>
  );
});

export default bindServices(InheritanceDemoContent, [
  BasicService,
  ChildService,
]);