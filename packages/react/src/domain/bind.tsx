import {
  Container,
  getGlobalContainer,
  RegisterOptions,
  Service,
  ServiceClass,
  ServiceFactory,
  ServiceIdentifier,
} from '@rabjs/service';
import { ComponentType, useContext, useEffect, useRef, forwardRef, PropsWithoutRef } from 'react';

import { IS_REACTIVE_COMPONENT } from '../observer';
import { UniversalFinalizationRegistry } from '../utils/UniversalFinalizationRegistry';
import { view } from '../view';

import { DomainContext } from './domainContext';
import { StrictContext } from './strictContext';

let containerId = 0;

/**
 * 检测组件是否已经被 observer 或 view 包裹过
 * 通过检查 IS_REACTIVE_COMPONENT 标志来判断
 */
function isAlreadyWrapped(Comp: any): boolean {
  return (Comp as any)[IS_REACTIVE_COMPONENT] === true;
}

/*
 * React 执行有 Render 阶段和 Commit阶段
 * 可能在Render阶段执行完，concurrent的时候被暂停了没有进入Commit阶段，然后组件卸载了，这时候因为没有进入Commit阶段，导致Effect等没触发所以一些东西没有销毁
 * 一下都是为了解决这个问题，这是根本问题，其他 Strict 执行两次都是因为这个问题衍生出来的，不是主要矛盾
 */
// 主要执行过程
// ┌─────────────────────────────────────────────┐
// │         Render 阶段（连续执行）                │
// ├─────────────────────────────────────────────┤
// │  console.log('Counter render')  // 第1次    │
// │  console.log('Counter render')  // 第2次    │
// │  ⬆️ 这两次 render 是连续完成的               │
// └─────────────────────────────────────────────┘
//                     ↓
//          Render 阶段全部完成
//                     ↓
// ┌─────────────────────────────────────────────┐
// │            Commit 阶段                       │
// ├─────────────────────────────────────────────┤
// │  • DOM 更新                                  │
// └─────────────────────────────────────────────┘
//                     ↓
// ┌─────────────────────────────────────────────┐
// │       异步阶段（Effect 执行）                 │
// ├─────────────────────────────────────────────┤
// │  console.log('use Effect')      // setup    │
// │  console.log('destory effect')  // cleanup  │
// │  console.log('use Effect')      // re-setup │
// └─────────────────────────────────────────────┘

type ADM = {
  container: Container | null;
  timmer: NodeJS.Timeout | null;
};
const universalFinalizationRegistry = new UniversalFinalizationRegistry((adm: ADM) => {
  adm.container?.destroy();
  adm.container = null;
});
export function bindServices<P extends Record<string, any> = any, TRef = any>(
  Comp: ComponentType<P>,
  servicesList: (
    | [
        ServiceIdentifier | ServiceClass,
        ServiceClass | ServiceFactory | RegisterOptions,
        RegisterOptions
      ]
    | ServiceClass
  )[]
) {
  // 默认父节点是全局
  function createADM(parrent: Container = getGlobalContainer()) {
    const container = new Container({
      name: `c_${++containerId}`,
    });
    container.setParent(parrent);
    servicesList.forEach(params => {
      Array.isArray(params)
        ? container.register.apply(container, params)
        : container.register.call(container, params);
    });
    return {
      container,
      timmer: null,
    };
  }
  // 包裹组件
  // 这里要确保container是一个，同时还要确保不会出现内存泄漏的问题
  const BindWrapper = forwardRef<TRef, any>(function BindWrapper(props: any, ref: any) {
    const admRef = useRef<ADM | null>(null);
    // 没有 context 分两种情况讨论
    // 严格模式下，应该报错，非严格模式下 默认到全局
    const strictContext = useContext(StrictContext);
    const domainContext = useContext(DomainContext);
    if (strictContext && !domainContext) {
      throw new Error('[RSJS] Strict mode must in Root Provider');
    }
    if (!admRef.current) {
      const adm = createADM(domainContext?.container);
      admRef.current = adm;
      // 防止 concurrent 模式下内存泄露
      universalFinalizationRegistry.register(admRef, adm, adm);
    }
    const adm = admRef.current!;
    useEffect(() => {
      // 走到这里就会确保一定会销毁了，所以可以 unregister 钩子
      universalFinalizationRegistry.unregister(adm);
      return () => {
        // 兜底进行 destroy的，业务不应该依赖此做任何事情
        universalFinalizationRegistry.register(admRef, adm, adm);
      };
    }, []);
    // 如果组件已经被 observer 或 view 包裹过，直接使用；否则调用 view 进行包裹
    const ViewComp = isAlreadyWrapped(Comp) ? Comp : view(Comp);
    return (
      <DomainContext.Provider
        value={{
          container: admRef.current.container!,
        }}
      >
        <ViewComp {...(props as any)} ref={ref} />
      </DomainContext.Provider>
    );
  });

  BindWrapper.displayName = `BindWrapper(${Comp.displayName || Comp.name || 'Component'})`;

  return BindWrapper;
}
