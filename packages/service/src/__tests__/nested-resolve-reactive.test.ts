/**
 * 嵌套 resolve 响应式回归测试
 *
 * 背景：Service 实例是 observable 代理。在另一个 Service 的方法/构造器里
 * 调用 this.resolve(X) 时，this._container 经代理读取会被包装成容器代理，
 * 下游 definition 也成为代理；代理的 set trap 会 toRawIfProxy 解包待缓存的
 * 实例，导致单例缓存住 raw target —— 之后任何组件 resolve 到的都是失去
 * 响应式的实例，UI 永远不更新。
 *
 * 修复：Service.resolve/emit/on/once 一律走 raw 容器。
 */

import { Service } from '../service';
import { Container } from '../ioc';
import { observe, isObservable } from '@rabjs/observer';

class EditorLikeService extends Service {
  phase: 'idle' | 'ready' = 'idle';
}

describe('嵌套 resolve 的实例必须保持响应式', () => {
  it('构造器内嵌套 resolve 触发实例化后，组件再 resolve 到的仍是响应式实例', () => {
    class RootService extends Service {
      editor: EditorLikeService;
      constructor() {
        super();
        this.editor = this.resolve(EditorLikeService);
      }
    }

    const container = new Container({ name: 'nested-ctor' });
    container.register(EditorLikeService);
    container.register(RootService);

    container.resolve(RootService); // EditorLikeService 在构造期间被嵌套实例化
    const editor = container.resolve(EditorLikeService); // 模拟组件 resolve

    expect(isObservable(editor)).toBe(true);

    let runs = 0;
    observe(() => {
      void editor.phase;
      runs++;
    });
    expect(runs).toBe(1);

    editor.phase = 'ready';
    expect(runs).toBe(2);
  });

  it('方法内嵌套 resolve 触发实例化后，组件再 resolve 到的仍是响应式实例', () => {
    class RootService extends Service {
      wire(): EditorLikeService {
        return this.resolve(EditorLikeService);
      }
    }

    const container = new Container({ name: 'nested-method' });
    container.register(EditorLikeService);
    container.register(RootService);

    const root = container.resolve(RootService);
    const nested = root.wire(); // 嵌套实例化
    const again = container.resolve(EditorLikeService);

    expect(again).toBe(nested);
    expect(isObservable(again)).toBe(true);
  });

  it('嵌套 resolve 与组件 resolve 返回同一响应式单例', () => {
    class RootService extends Service {
      grab(): EditorLikeService {
        return this.resolve(EditorLikeService);
      }
    }

    const container = new Container({ name: 'nested-identity' });
    container.register(EditorLikeService);
    container.register(RootService);

    // 先组件式实例化（缓存代理），再嵌套 resolve，两者必须一致且响应式
    const first = container.resolve(EditorLikeService);
    const root = container.resolve(RootService);
    expect(root.grab()).toBe(first);
    expect(isObservable(first)).toBe(true);
  });
});
