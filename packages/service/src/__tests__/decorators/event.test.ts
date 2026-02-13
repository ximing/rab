import { Service } from '../../service';
import { Container } from '../../ioc';
import { On, Once, cleanupEventListeners } from '../../decorators';
import { EventSystem } from '../../event';

describe('@On 和 @Once 装饰器', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container({ name: 'test' });
    EventSystem.clearAllGlobalEvents();
  });

  afterEach(() => {
    EventSystem.clearAllGlobalEvents();
    container.destroy();
  });

  describe('@On 装饰器 - 容器级别事件', () => {
    it('应该能够监听容器级别的事件', done => {
      class UserService extends Service {
        public loginUser: any = null;

        @On('user:login')
        onUserLogin(user: any) {
          this.loginUser = user;
        }
      }

      container.register(UserService);
      const userService = container.resolve(UserService);

      const testUser = { id: 1, name: 'John' };
      const emitter = EventSystem.getContainerEvents(container);

      emitter.emit('user:login', testUser);

      setTimeout(() => {
        expect(userService.loginUser).toEqual(testUser);
        done();
      }, 10);
    });

    it('应该能够监听多个事件', done => {
      class DataService extends Service {
        public data: any = null;
        public error: any = null;

        @On('data:update')
        onDataUpdate(data: any) {
          this.data = data;
        }

        @On('data:error')
        onDataError(error: any) {
          this.error = error;
        }
      }

      container.register(DataService);
      const dataService = container.resolve(DataService);

      const emitter = EventSystem.getContainerEvents(container);

      emitter.emit('data:update', { id: 1, value: 'test' });
      emitter.emit('data:error', new Error('Test error'));

      setTimeout(() => {
        expect(dataService.data).toEqual({ id: 1, value: 'test' });
        expect(dataService.error).toEqual(new Error('Test error'));
        done();
      }, 10);
    });

    it('应该能够移除事件监听器', done => {
      class CounterService extends Service {
        public count = 0;

        @On('counter:increment')
        onIncrement() {
          this.count++;
        }
      }

      container.register(CounterService);
      const counterService = container.resolve(CounterService);

      const emitter = EventSystem.getContainerEvents(container);

      emitter.emit('counter:increment');
      emitter.emit('counter:increment');

      setTimeout(() => {
        expect(counterService.count).toBe(2);

        // 移除监听器
        cleanupEventListeners(counterService);

        emitter.emit('counter:increment');

        setTimeout(() => {
          expect(counterService.count).toBe(2); // 不应该增加
          done();
        }, 10);
      }, 10);
    });
  });

  describe('@On 装饰器 - 全局事件', () => {
    it('应该能够监听全局事件', done => {
      class GlobalService extends Service {
        public appState: any = null;

        @On('app:initialized', { scope: 'global' })
        onAppInitialized(state: any) {
          this.appState = state;
        }
      }

      container.register(GlobalService);
      const globalService = container.resolve(GlobalService);

      const globalEmitter = EventSystem.getGlobalEvents();

      globalEmitter.emit('app:initialized', { version: '1.0.0' });

      setTimeout(() => {
        expect(globalService.appState).toEqual({ version: '1.0.0' });
        done();
      }, 10);
    });

    it('全局事件应该在所有容器中共享', done => {
      class Service1 extends Service {
        public message: string = '';

        @On('global:message', { scope: 'global' })
        onMessage(msg: string) {
          this.message = msg;
        }
      }

      class Service2 extends Service {
        public message: string = '';

        @On('global:message', { scope: 'global' })
        onMessage(msg: string) {
          this.message = msg;
        }
      }

      const container1 = new Container({ name: 'container1' });
      const container2 = new Container({ name: 'container2' });

      container1.register(Service1);
      container2.register(Service2);

      const service1 = container1.resolve(Service1);
      const service2 = container2.resolve(Service2);

      const globalEmitter = EventSystem.getGlobalEvents();
      globalEmitter.emit('global:message', 'Hello World');

      setTimeout(() => {
        expect(service1.message).toBe('Hello World');
        expect(service2.message).toBe('Hello World');
        done();
      }, 10);
    });
  });

  describe('@Once 装饰器 - 一次性事件', () => {
    it('应该只监听一次事件', done => {
      class OnceService extends Service {
        public count = 0;

        @Once('event:once')
        onEventOnce() {
          this.count++;
        }
      }

      container.register(OnceService);
      const onceService = container.resolve(OnceService);

      const emitter = EventSystem.getContainerEvents(container);

      emitter.emit('event:once');
      emitter.emit('event:once');
      emitter.emit('event:once');

      setTimeout(() => {
        expect(onceService.count).toBe(1);
        done();
      }, 10);
    });

    it('应该支持全局一次性事件', done => {
      class GlobalOnceService extends Service {
        public initialized = false;

        @Once('app:ready', { scope: 'global' })
        onAppReady() {
          this.initialized = true;
        }
      }

      container.register(GlobalOnceService);
      const globalOnceService = container.resolve(GlobalOnceService);

      const globalEmitter = EventSystem.getGlobalEvents();

      globalEmitter.emit('app:ready');
      globalEmitter.emit('app:ready');

      setTimeout(() => {
        expect(globalOnceService.initialized).toBe(true);
        done();
      }, 10);
    });
  });

  describe('混合使用 @On 和 @Once', () => {
    it('应该能够同时使用 @On 和 @Once', done => {
      class MixedService extends Service {
        public messages: string[] = [];
        public firstMessage: string = '';

        @On('message:send')
        onMessageSend(msg: string) {
          this.messages.push(msg);
        }

        @Once('message:first')
        onFirstMessage(msg: string) {
          this.firstMessage = msg;
        }
      }

      container.register(MixedService);
      const mixedService = container.resolve(MixedService);

      const emitter = EventSystem.getContainerEvents(container);

      emitter.emit('message:send', 'msg1');
      emitter.emit('message:first', 'first');
      emitter.emit('message:send', 'msg2');
      emitter.emit('message:first', 'second');

      setTimeout(() => {
        expect(mixedService.messages).toEqual(['msg1', 'msg2']);
        expect(mixedService.firstMessage).toBe('first');
        done();
      }, 10);
    });
  });

  describe('事件监听器的生命周期', () => {
    it('应该在 Service 初始化时自动绑定监听器', done => {
      class AutoBindService extends Service {
        public initialized = false;

        @On('service:init')
        onInit() {
          this.initialized = true;
        }
      }

      container.register(AutoBindService);
      const autoBindService = container.resolve(AutoBindService);

      const emitter = EventSystem.getContainerEvents(container);
      emitter.emit('service:init');

      setTimeout(() => {
        expect(autoBindService.initialized).toBe(true);
        done();
      }, 10);
    });

    it('应该能够手动清理事件监听器', done => {
      class CleanupService extends Service {
        public count = 0;

        @On('cleanup:test')
        onTest() {
          this.count++;
        }
      }

      container.register(CleanupService);
      const cleanupService = container.resolve(CleanupService);

      const emitter = EventSystem.getContainerEvents(container);

      emitter.emit('cleanup:test');
      expect(cleanupService.count).toBe(1);

      cleanupEventListeners(cleanupService);

      emitter.emit('cleanup:test');
      expect(cleanupService.count).toBe(1); // 不应该增加

      done();
    });
  });

  describe('容器级别事件隔离', () => {
    it('不同容器的事件应该相互隔离', done => {
      class IsolatedService extends Service {
        public count = 0;

        @On('isolated:event')
        onEvent() {
          this.count++;
        }
      }

      const container1 = new Container({ name: 'container1' });
      const container2 = new Container({ name: 'container2' });

      container1.register(IsolatedService);
      container2.register(IsolatedService);

      const service1 = container1.resolve(IsolatedService);
      const service2 = container2.resolve(IsolatedService);

      const emitter1 = EventSystem.getContainerEvents(container1);
      const emitter2 = EventSystem.getContainerEvents(container2);

      emitter1.emit('isolated:event');
      emitter2.emit('isolated:event');
      emitter2.emit('isolated:event');

      setTimeout(() => {
        expect(service1.count).toBe(1);
        expect(service2.count).toBe(2);
        done();
      }, 10);
    });
  });

  describe('事件参数传递', () => {
    it('应该能够正确传递事件参数', done => {
      class ParamService extends Service {
        public receivedParams: any[] = [];

        @On('param:test')
        onParamTest(...params: any[]) {
          this.receivedParams = params;
        }
      }

      container.register(ParamService);
      const paramService = container.resolve(ParamService);

      const emitter = EventSystem.getContainerEvents(container);
      emitter.emit('param:test', 'arg1', 42, { key: 'value' });

      setTimeout(() => {
        expect(paramService.receivedParams).toEqual(['arg1', 42, { key: 'value' }]);
        done();
      }, 10);
    });
  });
});
