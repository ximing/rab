/**
 * observer HOC 测试
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { observer } from '../observer';
import { useLocalObservable } from '../useLocalObservable';

describe('observer HOC', () => {
  it('应该追踪 observable 的变化', () => {
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
      }));

      return <div>{state.count}</div>;
    });

    render(<TestComponent />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('应该支持 forwardRef', () => {
    const TestComponent = observer(
      React.forwardRef((props: any, ref: React.Ref<HTMLDivElement>) => {
        const state = useLocalObservable(() => ({
          count: 0,
        }));

        return <div ref={ref}>{state.count}</div>;
      })
    );

    const ref = React.createRef<HTMLDivElement>();
    render(<TestComponent ref={ref} />);
    expect(ref.current).toBeInTheDocument();
  });

  it('应该在严格模式下工作', () => {
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
      }));

      return <div>{state.count}</div>;
    });

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('应该抛出错误当在已经被 memo 包装的组件上使用', () => {
    const Component = React.memo(() => <div>test</div>);

    expect(() => {
      observer(Component as any);
    }).toThrow();
  });

  it('应该继承组件的 displayName', () => {
    const TestComponent = observer(() => <div>test</div>);
    TestComponent.displayName = 'CustomName';

    expect(TestComponent.displayName).toBe('CustomName');
  });
});
