/**
 * @On 和 @Once 装饰器使用示例
 */

import { Service, Container, On, Once, EventSystem, cleanupEventListeners } from '../../main.js';

// ============ 示例 1: 基础事件监听 ============

class UserService extends Service {
  public currentUser: any = null;
  public loginCount = 0;

  // 监听全局登录事件
  @On('user:login', { scope: 'global' })
  onUserLogin(user: any) {
    this.currentUser = user;
    this.loginCount++;
    console.log(`User logged in: ${user.name}`);
  }

  // 监听容器级别的用户更新事件
  @On('user:update')
  onUserUpdate(updates: any) {
    if (this.currentUser) {
      this.currentUser = { ...this.currentUser, ...updates };
      console.log(`User updated:`, this.currentUser);
    }
  }

  // 监听一次性的应用初始化事件
  @Once('app:initialized', { scope: 'global' })
  onAppInitialized() {
    console.log('App initialized, UserService ready');
  }
}

// ============ 示例 2: 多个事件监听 ============

class NotificationService extends Service {
  public notifications: any[] = [];
  public unreadCount = 0;

  @On('notification:new')
  onNewNotification(notification: any) {
    this.notifications.push(notification);
    this.unreadCount++;
    console.log(`New notification: ${notification.message}`);
  }

  @On('notification:read')
  onNotificationRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.unreadCount--;
    }
  }

  @Once('notification:service:ready')
  onServiceReady() {
    console.log('Notification service is ready');
  }
}

// ============ 示例 3: 使用示例 ============

export function demonstrateEventDecorators() {
  // 创建容器
  const container = new Container({ name: 'app' });

  // 注册服务
  container.register(UserService);
  container.register(NotificationService);

  // 解析服务
  const userService = container.resolve(UserService);
  const notificationService = container.resolve(NotificationService);

  // 获取事件发射器
  const globalEmitter = EventSystem.getGlobalEvents();
  const containerEmitter = EventSystem.getContainerEvents(container);

  // 发送全局事件
  globalEmitter.emit('user:login', { id: 1, name: 'John Doe' });
  globalEmitter.emit('app:initialized');

  // 发送容器级别事件
  containerEmitter.emit('user:update', { email: 'john@example.com' });
  containerEmitter.emit('notification:new', { id: 1, message: 'Welcome!' });
  containerEmitter.emit('notification:service:ready');

  // 清理事件监听器
  cleanupEventListeners(userService);
  cleanupEventListeners(notificationService);
}

// ============ 示例 4: 全局事件 vs 容器级别事件 ============

export function demonstrateEventScopes() {
  class GlobalEventService extends Service {
    public globalMessage = '';

    @On('global:message', { scope: 'global' })
    onGlobalMessage(message: string) {
      this.globalMessage = message;
    }
  }

  class ContainerEventService extends Service {
    public containerMessage = '';

    @On('container:message')
    onContainerMessage(message: string) {
      this.containerMessage = message;
    }
  }

  // 创建两个容器
  const container1 = new Container({ name: 'container1' });
  const container2 = new Container({ name: 'container2' });

  // 在两个容器中注册服务
  container1.register(GlobalEventService);
  container1.register(ContainerEventService);
  container2.register(GlobalEventService);
  container2.register(ContainerEventService);

  // 解析服务
  const globalService1 = container1.resolve(GlobalEventService);
  const containerService1 = container1.resolve(ContainerEventService);
  const globalService2 = container2.resolve(GlobalEventService);
  const containerService2 = container2.resolve(ContainerEventService);

  // 发送全局事件 - 所有容器都会收到
  const globalEmitter = EventSystem.getGlobalEvents();
  globalEmitter.emit('global:message', 'Hello from global');

  console.log('Global event received:');
  console.log('  container1:', globalService1.globalMessage); // 'Hello from global'
  console.log('  container2:', globalService2.globalMessage); // 'Hello from global'

  // 发送容器级别事件 - 只有该容器会收到
  const emitter1 = EventSystem.getContainerEvents(container1);
  const emitter2 = EventSystem.getContainerEvents(container2);

  emitter1.emit('container:message', 'Hello from container1');
  emitter2.emit('container:message', 'Hello from container2');

  console.log('Container event received:');
  console.log('  container1:', containerService1.containerMessage); // 'Hello from container1'
  console.log('  container2:', containerService2.containerMessage); // 'Hello from container2'
}
