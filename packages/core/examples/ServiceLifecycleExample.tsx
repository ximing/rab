import React, { FC } from 'react';
import { Service } from '../decorator/service';
import { useService, RequestScopeProvider } from '../react/hooks/useService';
import { Service as BaseService } from '../service';
import { container, ScopeType, Transient, Singleton, Request } from '@rabjs/ioc';

// 定义一个简单的服务
@Service()
export class CounterService extends BaseService {
  private count = 0;

  increment() {
    this.count += 1;
    return this.count;
  }

  decrement() {
    this.count -= 1;
    return this.count;
  }

  getCount() {
    return this.count;
  }
}

// 使用Singleton生命周期的组件
export const SingletonCounter: FC = () => {
  const counter = useService(CounterService);

  return (
    <div>
      <h3>Singleton Counter</h3>
      <p>Count: {counter.getCount()}</p>
      <button onClick={() => counter.increment()}>Increment</button>
      <button onClick={() => counter.decrement()}>Decrement</button>
    </div>
  );
};

// 使用Transient生命周期的组件
export const TransientCounter: FC = () => {
  const counter = useService(CounterService, { scope: Transient });

  return (
    <div>
      <h3>Transient Counter</h3>
      <p>Count: {counter.getCount()}</p>
      <button onClick={() => counter.increment()}>Increment</button>
      <button onClick={() => counter.decrement()}>Decrement</button>
    </div>
  );
};

// 使用Request生命周期的组件
export const RequestCounter: FC = () => {
  const counter = useService(CounterService, { scope: Request });

  return (
    <div>
      <h3>Request Counter</h3>
      <p>Count: {counter.getCount()}</p>
      <button onClick={() => counter.increment()}>Increment</button>
      <button onClick={() => counter.decrement()}>Decrement</button>
    </div>
  );
};

// 使用RequestScopeProvider的组件
export const RequestScopeExample: FC = () => {
  return (
    <div>
      <h2>Request Scope Example</h2>
      <RequestScopeProvider scopeId="scope1">
        <div>
          <h3>Scope 1</h3>
          <RequestCounter />
          <RequestCounter />
        </div>
      </RequestScopeProvider>

      <RequestScopeProvider scopeId="scope2">
        <div>
          <h3>Scope 2</h3>
          <RequestCounter />
          <RequestCounter />
        </div>
      </RequestScopeProvider>
    </div>
  );
};

// 主示例组件
export const ServiceLifecycleExample: FC = () => {
  return (
    <div>
      <h1>Service Lifecycle Examples</h1>

      <div>
        <h2>Singleton Example</h2>
        <SingletonCounter />
        <SingletonCounter />
      </div>

      <div>
        <h2>Transient Example</h2>
        <TransientCounter />
        <TransientCounter />
      </div>

      <RequestScopeExample />
    </div>
  );
};
