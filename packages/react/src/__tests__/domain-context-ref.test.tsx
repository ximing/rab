/**
 * useDomainContext 的 Provider 值切换测试
 *
 * contextRef 只在首次渲染初始化、之后不回写，Provider 值变化后
 * consumer 仍拿到旧容器（#217）。
 */
import { render, screen, act } from '@testing-library/react';
import React, { useState } from 'react';
import { createContainer, Service } from '@rabjs/service';
import { DomainContext } from '../domain/domain-context';
import { useContainer } from '../domain/use-service';

class MarkerA extends Service {
  label = 'container-a';
}
class MarkerB extends Service {
  label = 'container-b';
}

describe('useDomainContext 跟随 Provider 值切换（#217）', () => {
  it('Provider 值变化后 consumer 解析到新容器', () => {
    const containerA = createContainer('a');
    const containerB = createContainer('b');
    containerA.register('marker', MarkerA);
    containerB.register('marker', MarkerB);

    const Consumer = () => {
      const container = useContainer();
      const svc = container.resolve<{ label: string }>('marker');
      return <span data-testid="label">{svc.label}</span>;
    };

    const App = () => {
      const [useA, setUseA] = useState(true);
      return (
        <>
          <DomainContext.Provider
            value={useA ? { container: containerA } : { container: containerB }}
          >
            <Consumer />
          </DomainContext.Provider>
          <button data-testid="toggle" onClick={() => setUseA(v => !v)}>
            toggle
          </button>
        </>
      );
    };

    const { unmount } = render(<App />);
    expect(screen.getByTestId('label')).toHaveTextContent('container-a');

    act(() => {
      screen.getByTestId('toggle').click();
    });

    // 切换后应从 containerB 解析
    expect(screen.getByTestId('label')).toHaveTextContent('container-b');

    unmount();
    containerA.destroy();
    containerB.destroy();
  });
});
