import {
  Container,
  getGlobalContainer,
  RegisterOptions,
  Service,
  ServiceClass,
  ServiceFactory,
  ServiceIdentifier,
} from '@rabjs/service';
import React, {
  ComponentType,
  useContext,
  useEffect,
  useRef,
  forwardRef,
  PropsWithoutRef,
} from 'react';

import { isAlreadyWrapped } from '../utils/react-helper';
import { UniversalFinalizationRegistry } from '../utils/universal-finalization-registry';
import { view } from '../view';

import { DomainContext } from './domain-context';
import { StrictContext } from './strict-context';

let containerId = 0;

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
  /** effect 已挂载。StrictMode 假卸载后会立刻再 setup，据此取消待执行的 destroy */
  committed: boolean;
};
const universalFinalizationRegistry = new UniversalFinalizationRegistry((adm: ADM) => {
  adm.container?.destroy();
  adm.container = null;
});

/**
 * 旧 RN JSC/Hermes 没有 queueMicrotask（与包内 FinalizationRegistry/WeakRef
 * 降级针对的是同一批环境），调用点做运行时探测并降级到 Promise。
 */
function deferToMicrotask(fn: () => void): void {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(fn);
  } else {
    Promise.resolve().then(fn);
  }
}
export function bindServices<P extends Record<string, any> = any, TRef = any>(
  Comp: ComponentType<P>,
  servicesList: (
    | [
        ServiceIdentifier | ServiceClass,
        ServiceClass | ServiceFactory | RegisterOptions,
        RegisterOptions,
      ]
    | ServiceClass
  )[],
  options?: { name?: string }
) {
  // 如果组件已经被 observer 或 view 包裹过，直接使用；否则调用 view 进行包裹
  const ViewComp = isAlreadyWrapped(Comp) ? Comp : view(Comp);
  const compName = options?.name ?? Comp.displayName ?? Comp.name ?? 'comp';

  // 默认父节点是全局
  function createADM(parrent: Container = getGlobalContainer()) {
    const container = new Container({
      name: `${compName}_${++containerId}`,
    });
    container.setParent(parrent);
    for (const params of servicesList) {
      Array.isArray(params)
        ? container.register.apply(container, params)
        : container.register.call(container, params);
    }
    return {
      container,
      committed: false,
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
    if (!adm.container) {
      // 容器在组件仍存活时被销毁：<Activity>/Offscreen 隐藏会跑 effect
      // cleanup，而 committed 标记 + microtask 只在 StrictMode 同帧重挂载
      // 时能取消销毁；跨 commit 的 hide→reveal 之间 microtask 早已执行。
      // render 时原地重建，让 reveal 后的子树拿到可用容器
      // （代价：隐藏期间丢失 service 状态，换 reveal 后可用）。
      // 注意原地替换 adm.container 而非整个 ADM：effect 闭包持有 adm。
      adm.container = createADM(domainContext?.container).container;
      // 重建发生在 render 阶段，重新挂上 GC 兜底——原注册在首次 effect
      // setup 时已 unregister；若本次 render 被并发丢弃或树在隐藏态被
      // 移除（不再跑 cleanup），由 finalizer 负责销毁这个容器。
      universalFinalizationRegistry.register(admRef, adm, adm);
    }
    useEffect(() => {
      // 走到这里就会确保一定会销毁了，所以可以 unregister 钩子
      adm.committed = true;
      universalFinalizationRegistry.unregister(adm);
      return () => {
        // unmount 时销毁容器（#218）。不能在 cleanup 里同步 destroy：
        // StrictMode 会立刻再跑 setup，子树仍在用这个容器。
        // microtask 里若 committed 又为 true 则跳过；真正卸载才会 destroy。
        // destroy 幂等，GC 仍兜底从未 commit 的 concurrent 树。
        adm.committed = false;
        deferToMicrotask(() => {
          if (adm.committed) {
            return;
          }
          if (adm.container) {
            adm.container.destroy();
            adm.container = null;
          }
          // 销毁后无需重新注册 finalizer：其函数体只销毁 container，
          // 此处已是 null，重注册是无可达效果的 no-op。若组件仍然存活
          // （Activity/Offscreen reveal），render 路径会重建并重新注册。
        });
      };
    }, []);
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

  BindWrapper.displayName = `BindWrapper(${compName})`;

  return BindWrapper;
}
