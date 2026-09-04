/**
 * view 类组件：挂载快照读取 accessor（getter）不得执行用户代码
 *
 * 背景：首渲染探针的快照捕获/对比用 Reflect.get(rawTarget, key) 直读。
 * 对 accessor 属性（如 @Memo getter）这会真实执行用户 getter，且 this
 * 是 raw 实例 —— @Memo 会以 raw 身份在 globalMemoCache 里另建一份
 * CacheState，其 reaction 在 raw 上注册不到任何依赖（raw 读取不过
 * proxy trap），缓存永不失效：挂载期 getter 被执行两次（副作用翻倍），
 * 此后任何 raw 身份读取（raw(service).x、未代理的内部访问）都返回
 * 首挂载时的陈旧值。
 *
 * 修复：快照只直读数据属性；accessor 无法安全重读，按「已变化」处理
 * （宁可多更一次），让 render 阶段的正常依赖收集经 proxy 缓存拿到正确值。
 */
import React, { act } from 'react';
import { render } from '@testing-library/react';
import { raw } from '@rabjs/observer';
import { Service, Memo } from '@rabjs/service';
import { view } from '../view';

/**
 * 手动应用 @Memo（本包 tsconfig 未开 experimentalDecorators，装饰器语法
 * 会让 tsc 报签名错误）。legacy 装饰器签名：(prototype, key, descriptor)。
 */
function memoize(proto: object, key: string): void {
  const desc = Object.getOwnPropertyDescriptor(proto, key)!;
  Object.defineProperty(proto, key, Memo()(proto, key, desc)!);
}

describe('view 类组件：挂载快照不执行用户 getter', () => {
  it('render 读取 @Memo getter：挂载只计算一次，raw 身份读取不返回陈旧缓存', () => {
    let execs = 0;

    class UserService extends Service {
      x = 1;

      get doubled() {
        execs++;
        return this.x * 2;
      }
    }
    memoize(UserService.prototype, 'doubled');

    const svc = new UserService();

    class ClassComp extends React.Component {
      render() {
        return <span data-testid="v">{svc.doubled}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    const { getByTestId } = render(<ReactiveClass />);

    expect(getByTestId('v').textContent).toBe('2');
    // 探针渲染经 proxy 缓存计算一次；快照捕获不得再以 raw 身份执行
    expect(execs).toBe(1);

    act(() => {
      svc.x = 5;
    });
    expect(getByTestId('v').textContent).toBe('10');
    // raw 身份读取：不得被挂载期快照留下的零依赖缓存毒化
    expect((raw(svc) as UserService).doubled).toBe(10);
  });

  it('render 读取 getter：commit 窗口内其底层依赖变更仍被检测（按已变化处理）', () => {
    // accessor 无法安全重读 → 快照按「已变化」处理 → forceUpdate 重渲染，
    // render 经 proxy 缓存读到新值 —— DOM 不停留在首渲染旧值
    class UserService extends Service {
      x = 1;

      get doubled() {
        return this.x * 2;
      }
    }
    memoize(UserService.prototype, 'doubled');

    const svc = new UserService();

    class ClassComp extends React.Component {
      componentDidMount() {
        svc.x = 7;
      }

      render() {
        return <span data-testid="v">{svc.doubled}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    const { getByTestId } = render(<ReactiveClass />);

    expect(getByTestId('v').textContent).toBe('14');
  });

  it('数据属性读取不受 accessor 处理影响：窗口内无变更时不产生伪 update', () => {
    class UserService extends Service {
      x = 1;
    }

    const svc = new UserService();
    const calls: string[] = [];

    class ClassComp extends React.Component {
      componentDidUpdate() {
        calls.push('cDU');
      }

      render() {
        return <span>{svc.x}</span>;
      }
    }

    const ReactiveClass = view(ClassComp);
    render(<ReactiveClass />);

    expect(calls).not.toContain('cDU');
  });
});
