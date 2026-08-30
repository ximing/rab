/**
 * useAsObservableSource Hook 测试
 *
 * React dev 模式会 Object.freeze 函数组件的 props；hook 必须在拷贝上
 * 建 observable，而不是包裹原对象（#216）。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { observable, observer, useAsObservableSource } from '../main';
import { observe } from '@rabjs/observer';

describe('useAsObservableSource', () => {
  it('props 被 freeze（React dev 行为）时不抛错，且值可读（#216）', () => {
    const Frozen = observer((props: { extra: string }) => {
      expect(Object.isFrozen(props)).toBe(true);
      const src = useAsObservableSource(props);
      return <div data-testid="v">{src.extra}</div>;
    });

    expect(() => render(<Frozen extra="hello" />)).not.toThrow();
    expect(screen.getByTestId('v')).toHaveTextContent('hello');
  });

  it('手动 freeze 的对象传入也不抛错（#216）', () => {
    const Comp = observer(() => {
      const src = useAsObservableSource(Object.freeze({ n: 42 }) as { n: number });
      return <div data-testid="n">{src.n}</div>;
    });

    expect(() => render(<Comp />)).not.toThrow();
    expect(screen.getByTestId('n')).toHaveTextContent('42');
  });

  it('props 更新时 observable 源同步新值', () => {
    const Counter = observer((props: { count: number }) => {
      const src = useAsObservableSource(props);
      return <div data-testid="c">{src.count}</div>;
    });

    const { rerender } = render(<Counter count={0} />);
    expect(screen.getByTestId('c')).toHaveTextContent('0');

    rerender(<Counter count={5} />);
    expect(screen.getByTestId('c')).toHaveTextContent('5');
  });

  it('observable 源是响应式的：外部 reaction 能追踪其变化', () => {
    const seen: number[] = [];
    let srcRef: { n: number } | null = null;

    const Comp = observer((props: { n: number }) => {
      const src = useAsObservableSource(props);
      if (!srcRef) {
        srcRef = src;
        observe(() => {
          seen.push(srcRef!.n);
        });
      }
      return <div data-testid="v">{src.n}</div>;
    });

    const { rerender } = render(<Comp n={1} />);
    expect(seen).toEqual([1]);

    // rerender 会把新值写进 observable 源，外部 reaction 被唤醒
    rerender(<Comp n={7} />);
    expect(seen).toEqual([1, 7]);
    expect(screen.getByTestId('v')).toHaveTextContent('7');
  });

  it('同一次挂载内多次渲染复用同一 observable 实例', () => {
    const instances: unknown[] = [];
    const Comp = observer((props: { n: number }) => {
      const src = useAsObservableSource(props);
      instances.push(src);
      return <div data-testid="v">{src.n}</div>;
    });

    const { rerender } = render(<Comp n={1} />);
    rerender(<Comp n={2} />);
    rerender(<Comp n={3} />);
    expect(instances.length).toBe(3);
    expect(instances[0]).toBe(instances[1]);
    expect(instances[1]).toBe(instances[2]);
  });

  it('值更新触发依赖该源的计算重跑（useLocalObservable 组合）', () => {
    const Display = observer((props: { name: string }) => {
      const src = useAsObservableSource(props);
      return <div data-testid="name">User: {src.name}</div>;
    });

    const { rerender } = render(<Display name="alice" />);
    expect(screen.getByTestId('name')).toHaveTextContent('User: alice');

    rerender(<Display name="bob" />);
    expect(screen.getByTestId('name')).toHaveTextContent('User: bob');
  });

  it('不修改调用方传入的原对象（保持 freeze 不被破坏）', () => {
    const frozen = Object.freeze({ tag: 'x' });
    const Comp = observer(() => {
      const src = useAsObservableSource(frozen);
      return <div>{src.tag}</div>;
    });

    render(<Comp />);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect((frozen as { tag: string }).tag).toBe('x');
  });
});
