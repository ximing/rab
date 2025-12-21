/**
 * Service 事件方法测试
 * 测试 Service 类的 on、once、off、emit 方法
 */

import { Service } from '../service';
import { Container } from '../ioc';
import { EventSystem } from '../event';

describe('Service 事件方法', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container({ name: 'test' });
    EventSystem.clearAllGlobalEvents();
  });

  afterEach(() => {
    container.destroy();
    EventSystem.clearAllGlobalEvents();
  });

  describe('on 方法', () => {
    it('应该能够监听容器级别事件（默认）', done => {
      class TestService extends Service {
        public receivedData: any = null;

        constructor(container: Container) {
          super();

          this.on('test:event', (data: any) => {
            this.receivedData = data;
          });
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      const testData = { id: 1, name: 'test' };
      service.emit('test:event', testData);

      setTimeout(() => {
        expect(service.receivedData).toEqual(testData);
        done();
      }, 10);
    });

    it('应该能够监听全局事件', done => {
      class TestService extends Service {
        public receivedData: any = null;

        constructor(container: Container) {
          super();

          this.on(
            'global:event',
            (data: any) => {
              this.receivedData = data;
            },
            'global'
          );
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      const testData = { id: 2, name: 'global' };
      service.emit('global:event', testData, 'global');

      setTimeout(() => {
        expect(service.receivedData).toEqual(testData);
        done();
      }, 10);
    });

    it('应该支持链式调用', () => {
      class TestService extends Service {
        constructor(container: Container) {
          super();

          const result = this.on('event1', () => {}).on('event2', () => {});

          expect(result).toBe(this);
        }
      }

      container.register(TestService);
      container.resolve(TestService);
    });
  });

  describe('once 方法', () => {
    it('应该只触发一次容器级别事件', done => {
      let callCount = 0;

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.once('test:once', () => {
            callCount++;
          });
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.emit('test:once');
      service.emit('test:once');
      service.emit('test:once');

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 10);
    });

    it('应该只触发一次全局事件', done => {
      let callCount = 0;

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.once(
            'global:once',
            () => {
              callCount++;
            },
            'global'
          );
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.emit('global:once', undefined, 'global');
      service.emit('global:once', undefined, 'global');
      service.emit('global:once', undefined, 'global');

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 10);
    });
  });

  describe('off 方法', () => {
    it('应该能够移除特定的事件监听器', done => {
      let callCount = 0;

      class TestService extends Service {
        private handler = () => {
          callCount++;
        };

        constructor(container: Container) {
          super();
          this.on('test:event', this.handler);
        }

        removeListener() {
          this.off('test:event', this.handler);
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.emit('test:event');

      setTimeout(() => {
        expect(callCount).toBe(1);

        service.removeListener();
        service.emit('test:event');

        setTimeout(() => {
          expect(callCount).toBe(1); // 不应该增加
          done();
        }, 10);
      }, 10);
    });

    it('应该能够移除事件的所有监听器', done => {
      let count1 = 0;
      let count2 = 0;

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.on('test:event', () => {
            count1++;
          });

          this.on('test:event', () => {
            count2++;
          });
        }

        removeAllListeners() {
          this.off('test:event');
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.emit('test:event');

      setTimeout(() => {
        expect(count1).toBe(1);
        expect(count2).toBe(1);

        service.removeAllListeners();
        service.emit('test:event');

        setTimeout(() => {
          expect(count1).toBe(1); // 不应该增加
          expect(count2).toBe(1); // 不应该增加
          done();
        }, 10);
      }, 10);
    });

    it('应该能够移除全局事件监听器', done => {
      let callCount = 0;

      class TestService extends Service {
        private handler = () => {
          callCount++;
        };

        constructor(container: Container) {
          super();
          this.on('global:event', this.handler, 'global');
        }

        removeListener() {
          this.off('global:event', this.handler, 'global');
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.emit('global:event', undefined, 'global');

      setTimeout(() => {
        expect(callCount).toBe(1);

        service.removeListener();
        service.emit('global:event', undefined, 'global');

        setTimeout(() => {
          expect(callCount).toBe(1); // 不应该增加
          done();
        }, 10);
      }, 10);
    });
  });

  describe('emit 方法', () => {
    it('应该能够发送容器级别事件', done => {
      const receivedData: any[] = [];

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.on('test:event', (data: any) => {
            receivedData.push(data);
          });
        }

        sendEvent(data: any) {
          this.emit('test:event', data);
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.sendEvent({ id: 1 });
      service.sendEvent({ id: 2 });

      setTimeout(() => {
        expect(receivedData).toEqual([{ id: 1 }, { id: 2 }]);
        done();
      }, 10);
    });

    it('应该能够发送全局事件', done => {
      const receivedData: any[] = [];

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.on(
            'global:event',
            (data: any) => {
              receivedData.push(data);
            },
            'global'
          );
        }

        sendGlobalEvent(data: any) {
          this.emit('global:event', data, 'global');
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.sendGlobalEvent({ id: 1 });
      service.sendGlobalEvent({ id: 2 });

      setTimeout(() => {
        expect(receivedData).toEqual([{ id: 1 }, { id: 2 }]);
        done();
      }, 10);
    });

    it('应该能够发送不带数据的事件', done => {
      let callCount = 0;

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.on('test:event', () => {
            callCount++;
          });
        }

        sendEvent() {
          this.emit('test:event');
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      service.sendEvent();

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 10);
    });
  });

  describe('容器隔离', () => {
    it('容器级别事件应该在不同容器间隔离', done => {
      const container1Messages: any[] = [];
      const container2Messages: any[] = [];

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.on('test:event', (data: any) => {
            const containerName = this._container.getName();
            if (containerName === 'container1') {
              container1Messages.push(data);
            } else {
              container2Messages.push(data);
            }
          });
        }
      }

      const container1 = new Container({ name: 'container1' });
      const container2 = new Container({ name: 'container2' });

      container1.register(TestService);
      container2.register(TestService);

      const service1 = container1.resolve(TestService);
      const service2 = container2.resolve(TestService);

      service1.emit('test:event', { from: 'service1' });
      service2.emit('test:event', { from: 'service2' });

      setTimeout(() => {
        expect(container1Messages).toEqual([{ from: 'service1' }]);
        expect(container2Messages).toEqual([{ from: 'service2' }]);

        container1.destroy();
        container2.destroy();
        done();
      }, 10);
    });

    it('全局事件应该在所有容器间共享', done => {
      const allMessages: any[] = [];

      class TestService extends Service {
        constructor(container: Container) {
          super();

          this.on(
            'global:event',
            (data: any) => {
              allMessages.push(data);
            },
            'global'
          );
        }
      }

      const container1 = new Container({ name: 'container1' });
      const container2 = new Container({ name: 'container2' });

      container1.register(TestService);
      container2.register(TestService);

      const service1 = container1.resolve(TestService);
      const service2 = container2.resolve(TestService);

      service1.emit('global:event', { from: 'service1' }, 'global');
      service2.emit('global:event', { from: 'service2' }, 'global');

      setTimeout(() => {
        // 两个 service 都应该收到两条消息
        expect(allMessages.length).toBe(4);
        expect(allMessages).toContainEqual({ from: 'service1' });
        expect(allMessages).toContainEqual({ from: 'service2' });

        container1.destroy();
        container2.destroy();
        done();
      }, 10);
    });
  });

  describe('Service 间通信', () => {
    it('同一容器内的 Service 应该能够通过事件通信', done => {
      class ServiceA extends Service {
        constructor(container: Container) {
          super();
        }

        sendMessage(message: string) {
          this.emit('service:message', message);
        }
      }

      class ServiceB extends Service {
        public receivedMessages: string[] = [];

        constructor(container: Container) {
          super();

          this.on('service:message', (message: string) => {
            this.receivedMessages.push(message);
          });
        }
      }

      container.register(ServiceA);
      container.register(ServiceB);

      const serviceA = container.resolve(ServiceA);
      const serviceB = container.resolve(ServiceB);

      serviceA.sendMessage('Hello from A');
      serviceA.sendMessage('Another message');

      setTimeout(() => {
        expect(serviceB.receivedMessages).toEqual(['Hello from A', 'Another message']);
        done();
      }, 10);
    });

    it('不同容器的 Service 应该能够通过全局事件通信', done => {
      class ServiceA extends Service {
        constructor(container: Container) {
          super();
        }

        sendGlobalMessage(message: string) {
          this.emit('global:message', message, 'global');
        }
      }

      class ServiceB extends Service {
        public receivedMessages: string[] = [];

        constructor(container: Container) {
          super();

          this.on(
            'global:message',
            (message: string) => {
              this.receivedMessages.push(message);
            },
            'global'
          );
        }
      }

      const container1 = new Container({ name: 'container1' });
      const container2 = new Container({ name: 'container2' });

      container1.register(ServiceA);
      container2.register(ServiceB);

      const serviceA = container1.resolve(ServiceA);
      const serviceB = container2.resolve(ServiceB);

      serviceA.sendGlobalMessage('Hello from container1');

      setTimeout(() => {
        expect(serviceB.receivedMessages).toEqual(['Hello from container1']);

        container1.destroy();
        container2.destroy();
        done();
      }, 10);
    });
  });

  describe('类型推导', () => {
    it('应该支持泛型类型推导', done => {
      interface UserData {
        id: number;
        name: string;
      }

      class TestService extends Service {
        public receivedUser: UserData | null = null;

        constructor(container: Container) {
          super();

          this.on<UserData>('user:login', user => {
            this.receivedUser = user;
          });
        }

        login(user: UserData) {
          this.emit<UserData>('user:login', user);
        }
      }

      container.register(TestService);
      const service = container.resolve(TestService);

      const user: UserData = { id: 1, name: 'John' };
      service.login(user);

      setTimeout(() => {
        expect(service.receivedUser).toEqual(user);
        done();
      }, 10);
    });
  });
});
