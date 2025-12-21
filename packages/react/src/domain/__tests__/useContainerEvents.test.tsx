/**
 * useContainerEvents Hook 测试
 */

import React, { useEffect, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Service } from '@rabjs/service';
import { bindServices } from '../bind';
import { useContainerEvents } from '../useContainerEvents';
import { useService } from '../useService';

describe('useContainerEvents', () => {
  it('应该能够获取容器的事件发射器', () => {
    let events: any = null;

    function TestComponent() {
      events = useContainerEvents();
      return <div>Test</div>;
    }

    const Wrapped = bindServices(TestComponent, []);

    render(<Wrapped />);

    expect(events).toBeDefined();
    expect(typeof events.on).toBe('function');
    expect(typeof events.emit).toBe('function');
    expect(typeof events.off).toBe('function');
  });

  it('应该能够监听和发送容器级别的事件', async () => {
    const messages: string[] = [];

    function TestComponent() {
      const events = useContainerEvents();

      useEffect(() => {
        const handler = (message: string) => {
          messages.push(message);
        };

        events.on('test:message', handler);

        return () => {
          events.off('test:message', handler);
        };
      }, [events]);

      const handleClick = () => {
        events.emit('test:message', 'Hello World');
      };

      return <button onClick={handleClick}>Send Message</button>;
    }

    const Wrapped = bindServices(TestComponent, []);

    render(<Wrapped />);

    const button = screen.getByText('Send Message');
    fireEvent.click(button);

    await waitFor(() => {
      expect(messages).toEqual(['Hello World']);
    });
  });

  it('应该支持多个组件监听同一事件', async () => {
    const receivedMessages: Record<string, string[]> = {
      component1: [],
      component2: [],
    };

    function Component1() {
      const events = useContainerEvents();

      useEffect(() => {
        const handler = (message: string) => {
          receivedMessages.component1.push(message);
        };

        events.on('shared:event', handler);

        return () => {
          events.off('shared:event', handler);
        };
      }, [events]);

      return <div>Component 1</div>;
    }

    function Component2() {
      const events = useContainerEvents();

      useEffect(() => {
        const handler = (message: string) => {
          receivedMessages.component2.push(message);
        };

        events.on('shared:event', handler);

        return () => {
          events.off('shared:event', handler);
        };
      }, [events]);

      const handleClick = () => {
        events.emit('shared:event', 'Broadcast Message');
      };

      return <button onClick={handleClick}>Broadcast</button>;
    }

    function TestComponent() {
      return (
        <>
          <Component1 />
          <Component2 />
        </>
      );
    }

    const Wrapped = bindServices(TestComponent, []);

    render(<Wrapped />);

    const button = screen.getByText('Broadcast');
    fireEvent.click(button);

    await waitFor(() => {
      expect(receivedMessages.component1).toEqual(['Broadcast Message']);
      expect(receivedMessages.component2).toEqual(['Broadcast Message']);
    });
  });

  it('应该支持 Service 和组件之间的事件通信', async () => {
    const serviceMessages: string[] = [];
    const componentMessages: string[] = [];

    class TestService extends Service {
      constructor(container: any) {
        super(container);

        // Service 监听事件
        container.events.on('component:message', (message: string) => {
          serviceMessages.push(message);
        });
      }

      sendToComponent(message: string) {
        this._container.events.emit('service:message', message);
      }
    }

    function TestComponent() {
      const events = useContainerEvents();
      const service = useService(TestService);

      useEffect(() => {
        const handler = (message: string) => {
          componentMessages.push(message);
        };

        events.on('service:message', handler);

        return () => {
          events.off('service:message', handler);
        };
      }, [events]);

      const sendToService = () => {
        events.emit('component:message', 'Hello from Component');
      };

      const requestFromService = () => {
        service.sendToComponent('Hello from Service');
      };

      return (
        <div>
          <button onClick={sendToService}>Send to Service</button>
          <button onClick={requestFromService}>Request from Service</button>
        </div>
      );
    }

    const Wrapped = bindServices(TestComponent, [TestService]);

    render(<Wrapped />);

    // 组件发送消息给 Service
    const sendButton = screen.getByText('Send to Service');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(serviceMessages).toEqual(['Hello from Component']);
    });

    // Service 发送消息给组件
    const requestButton = screen.getByText('Request from Service');
    fireEvent.click(requestButton);

    await waitFor(() => {
      expect(componentMessages).toEqual(['Hello from Service']);
    });
  });

  it('应该在不同容器中隔离事件', async () => {
    const container1Messages: string[] = [];
    const container2Messages: string[] = [];

    function TestComponent({ containerId }: { containerId: string }) {
      const events = useContainerEvents();

      useEffect(() => {
        const handler = (message: string) => {
          if (containerId === 'container1') {
            container1Messages.push(message);
          } else {
            container2Messages.push(message);
          }
        };

        events.on('test:event', handler);

        return () => {
          events.off('test:event', handler);
        };
      }, [events, containerId]);

      const handleClick = () => {
        events.emit('test:event', `Message from ${containerId}`);
      };

      return <button onClick={handleClick}>{containerId}</button>;
    }

    const Wrapped1 = bindServices(() => <TestComponent containerId="container1" />, []);
    const Wrapped2 = bindServices(() => <TestComponent containerId="container2" />, []);

    const { container } = render(
      <>
        <Wrapped1 />
        <Wrapped2 />
      </>
    );

    const button1 = screen.getByText('container1');
    const button2 = screen.getByText('container2');

    fireEvent.click(button1);
    fireEvent.click(button2);

    await waitFor(() => {
      // 每个容器只接收自己的事件
      expect(container1Messages).toEqual(['Message from container1']);
      expect(container2Messages).toEqual(['Message from container2']);
    });
  });

  it('应该在组件卸载时自动清理事件监听器', async () => {
    let listenerCount = 0;
    let capturedEvents: any = null;

    function TestComponent() {
      const events = useContainerEvents();
      capturedEvents = events;

      useEffect(() => {
        const handler = () => {
          listenerCount++;
        };

        events.on('test:event', handler);

        return () => {
          events.off('test:event', handler);
        };
      }, [events]);

      return <div>Test</div>;
    }

    const Wrapped = bindServices(TestComponent, []);

    const { unmount } = render(<Wrapped />);

    // 等待组件挂载完成
    await waitFor(() => {
      expect(capturedEvents).not.toBeNull();
    });

    // 发送事件
    capturedEvents.emit('test:event');

    await waitFor(() => {
      expect(listenerCount).toBe(1);
    });

    // 卸载组件
    unmount();

    // 再次发送事件，监听器应该已被清理
    capturedEvents.emit('test:event');

    // 等待一小段时间确保没有新的事件被处理
    await new Promise(resolve => setTimeout(resolve, 100));

    // 监听器已清理，计数不应增加
    expect(listenerCount).toBe(1);
  });
});
