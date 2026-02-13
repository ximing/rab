/**
 * 覆盖率改进测试 - 针对低覆盖率的代码路径
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { observer } from '../observer';
import { useObserver } from '../useObserver';
import { observable } from '@rabjs/observer';
import { RSStrict } from '../domain/strictContext';
import { bindServices } from '../domain/bind';
import { useService } from '../domain/useService';
import { Service } from '@rabjs/service';

// ============ observer.tsx 分支覆盖率改进 ============

describe('observer HOC - 分支覆盖率改进', () => {
  it('应该在传入 memo 组件时抛出错误', () => {
    const Component = React.memo(() => <div>Test</div>);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      observer(Component);
    }).toThrow('你正在尝试在已经被 `observer` 或 `React.memo` 包装的函数组件上使用 `observer`');

    consoleErrorSpy.mockRestore();
  });

  it('应该正确处理 forwardRef 组件', () => {
    const state = observable({ value: 'test' });
    const Component = React.forwardRef<HTMLDivElement>((props, ref) => (
      <div ref={ref}>{state.value}</div>
    ));

    const ObservedComponent = observer(Component);
    const divRef = React.createRef<HTMLDivElement>();

    render(<ObservedComponent ref={divRef} />);

    expect(divRef.current).toBeInTheDocument();
  });

  it('应该正确处理 observer 包装', () => {
    const Component = () => <div>Test</div>;
    Component.displayName = 'CustomName';

    const ObservedComponent = observer(Component);

    // observer 返回的是 memo(forwardRef(...))，验证组件被正确包装
    expect(ObservedComponent).toBeDefined();
    render(<ObservedComponent />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('应该复制静态属性', () => {
    const Component = () => <div>Test</div>;
    (Component as any).staticProp = 'value';

    const ObservedComponent = observer(Component);

    expect((ObservedComponent as any).staticProp).toBe('value');
  });

  it('应该标记为响应式组件', () => {
    const Component = () => <div>Test</div>;
    const ObservedComponent = observer(Component);

    expect((ObservedComponent as any)[Symbol.for('@rabjs/react:isReactiveComponent')]).toBe(
      true
    );
  });
});

// ============ useObserver.ts 分支覆盖率改进 ============

describe('useObserver Hook - 分支覆盖率改进', () => {
  it('应该追踪嵌套对象的变化', async () => {
    const state = observable({
      user: { name: 'John', age: 30 },
    });

    const Component = () => {
      const name = useObserver(() => state.user.name);
      return <div>{name}</div>;
    };

    render(<Component />);

    expect(screen.getByText('John')).toBeInTheDocument();

    act(() => {
      state.user.name = 'Jane';
    });

    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });
  });

  it('应该追踪数组长度的变化', async () => {
    const state = observable({ items: [1, 2, 3] });

    const Component = () => {
      const length = useObserver(() => state.items.length);
      return <div>{length}</div>;
    };

    render(<Component />);

    expect(screen.getByText('3')).toBeInTheDocument();

    act(() => {
      state.items.push(4);
    });

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('应该支持自定义调试名称', () => {
    const state = observable({ value: 'test' });

    const Component = () => {
      const value = useObserver(() => state.value, 'CustomDebugName');
      return <div>{value}</div>;
    };

    render(<Component />);

    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('应该在条件渲染中正确工作', async () => {
    const state = observable({ show: true, value: 'visible' });

    const Component = () => {
      const content = useObserver(() => {
        if (state.show) {
          return <span>{state.value}</span>;
        }
        return <span>hidden</span>;
      });
      return <div>{content}</div>;
    };

    render(<Component />);

    expect(screen.getByText('visible')).toBeInTheDocument();

    act(() => {
      state.show = false;
    });

    await waitFor(() => {
      expect(screen.getByText('hidden')).toBeInTheDocument();
    });
  });

  it('应该追踪多个 observable 的组合', async () => {
    const state1 = observable({ value: 'a' });
    const state2 = observable({ value: 'b' });

    const Component = () => {
      const combined = useObserver(() => `${state1.value}-${state2.value}`);
      return <div>{combined}</div>;
    };

    render(<Component />);

    expect(screen.getByText('a-b')).toBeInTheDocument();

    act(() => {
      state1.value = 'a1';
    });

    await waitFor(() => {
      expect(screen.getByText('a1-b')).toBeInTheDocument();
    });
  });
});

// ============ domain 相关功能改进 ============

describe('Domain 功能 - 覆盖率改进', () => {
  it('RSStrict 应该渲染子组件', () => {
    const Component = () => <div>Strict Content</div>;

    render(
      <RSStrict>
        <Component />
      </RSStrict>
    );

    expect(screen.getByText('Strict Content')).toBeInTheDocument();
  });

  it('bindServices 应该创建 Provider 组件', () => {
    class TestService extends Service {
      value = 'test';
    }

    const Component = () => {
      const service = useService(TestService);
      return <div>{service.value}</div>;
    };

    const Provider = bindServices(Component, [TestService]);

    render(<Provider />);

    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('useService 应该返回服务实例', () => {
    class TestService extends Service {
      name = 'service';
    }

    let capturedService: any;

    const Component = () => {
      capturedService = useService(TestService);
      return <div>{capturedService.name}</div>;
    };

    const Provider = bindServices(Component, [TestService]);

    render(<Provider />);

    expect(capturedService).toBeInstanceOf(TestService);
  });

  it('bindServices 应该支持多个服务', () => {
    class Service1 extends Service {
      name = 'service1';
    }

    class Service2 extends Service {
      name = 'service2';
    }

    const Component = () => {
      const s1 = useService(Service1);
      const s2 = useService(Service2);
      return (
        <div>
          {s1.name} {s2.name}
        </div>
      );
    };

    const Provider = bindServices(Component, [Service1, Service2]);

    render(<Provider />);

    expect(screen.getByText('service1 service2')).toBeInTheDocument();
  });
});

// ============ utils 相关功能改进 ============

describe('Utils 功能 - 覆盖率改进', () => {
  it('printDebugValue 应该处理 null reaction', () => {
    const { printDebugValue } = require('../utils/printDebugValue');
    const result = printDebugValue(null);
    expect(result).toBe('disposed');
  });

  it('printDebugValue 应该处理有效的 reaction', () => {
    const { printDebugValue } = require('../utils/printDebugValue');
    const mockReaction = {
      toString: () => '[Reaction@12345]',
    };
    const result = printDebugValue(mockReaction);
    expect(result).toMatch(/^Reaction@/);
  });
});

// ============ 复杂场景测试 ============

describe('复杂场景 - 覆盖率改进', () => {
  it('应该在嵌套 observer 组件中正确工作', async () => {
    const state = observable({ count: 0 });

    const InnerComponent = observer(() => <span>{state.count}</span>);

    const OuterComponent = observer(() => (
      <div>
        <InnerComponent />
      </div>
    ));

    render(<OuterComponent />);

    expect(screen.getByText('0')).toBeInTheDocument();

    act(() => {
      state.count = 1;
    });

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('应该在多个 observer 组件中正确追踪', async () => {
    const state = observable({ a: 'a', b: 'b' });

    const ComponentA = observer(() => <div>{state.a}</div>);
    const ComponentB = observer(() => <div>{state.b}</div>);

    render(
      <div>
        <ComponentA />
        <ComponentB />
      </div>
    );

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();

    act(() => {
      state.a = 'a1';
    });

    await waitFor(() => {
      expect(screen.getByText('a1')).toBeInTheDocument();
    });

    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('应该在条件渲染中正确工作', async () => {
    const state = observable({ show: true, value: 'visible' });

    const Component = observer(() => (
      <div>{state.show ? <span>{state.value}</span> : <span>hidden</span>}</div>
    ));

    render(<Component />);

    expect(screen.getByText('visible')).toBeInTheDocument();

    act(() => {
      state.show = false;
    });

    await waitFor(() => {
      expect(screen.getByText('hidden')).toBeInTheDocument();
    });

    act(() => {
      state.show = true;
    });

    await waitFor(() => {
      expect(screen.getByText('visible')).toBeInTheDocument();
    });
  });

  it('应该在列表渲染中正确追踪', async () => {
    const state = observable({
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
    });

    const Component = observer(() => (
      <ul>
        {state.items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    ));

    render(<Component />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();

    act(() => {
      state.items[0].name = 'Updated Item 1';
    });

    await waitFor(() => {
      expect(screen.getByText('Updated Item 1')).toBeInTheDocument();
    });
  });
});
