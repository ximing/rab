import {
  Component,
  memo,
  ComponentType,
  ComponentClass,
  useRef,
  useSyncExternalStore,
} from 'react';
import { observe, unobserve } from '@rabjs/observer-util';

import { hasHooks } from '../utils/helpers';
import { ownerComponent } from '../symbols';

export let isInsideFunctionComponent = false;
export let isInsideClassComponentRender = false;
export let isInsideFunctionComponentWithoutHooks = false;

export function view<P = any, S = any>(Comp: ComponentType<P>): ComponentType<P> {
  const isStatelessComp = !Comp.prototype?.isReactComponent;
  let ReactiveComp: ComponentType<P>;
  if (isStatelessComp && hasHooks) {
    // use a hook based reactive wrapper when we can
    ReactiveComp = (props) => {
      // use a dummy setState to update the component
      const admRef = useRef<any | null>(null);
      if (!admRef.current) {
        const adm = {
          reaction: null,
          onStoreChange: null,
          stateVersion: Symbol(),
          subscribe(onStoreChange: () => void) {
            // Do NOT access admRef here!
            adm.reaction && unobserve(adm.reaction);
            adm.reaction = null;
            // @ts-ignore
            adm.onStoreChange = onStoreChange;
            if (!adm.reaction) {
              // We've lost our reaction and therefore all subscriptions, occurs when:
              // 1. Timer based finalization registry disposed reaction before component mounted.
              // 2. React "re-mounts" same component without calling render in between (typically <StrictMode>).
              // We have to recreate reaction and schedule re-render to recreate subscriptions,
              // even if state did not change.
              // @ts-ignore
              adm.reaction = observe(Comp, {
                scheduler: () => {
                  adm.stateVersion = Symbol();
                  // @ts-ignore
                  adm.onStoreChange?.();
                },
                lazy: true,
              });
              // `onStoreChange` won't force update if subsequent `getSnapshot` returns same value.
              // So we make sure that is not the case
              adm.stateVersion = Symbol();
            }

            return () => {
              // Do NOT access admRef here!
              adm.onStoreChange = null;
              adm.reaction && unobserve(adm.reaction);
              adm.reaction = null;
            };
          },
          getSnapshot() {
            // Do NOT access admRef here!
            return adm.stateVersion;
          },
        };
        admRef.current = adm;
      }

      const adm = admRef.current!;

      if (!adm.reaction) {
        // First render or reaction was disposed by registry before subscribe
        adm.reaction = observe(Comp, {
          scheduler: () => {
            adm.stateVersion = Symbol();
            // @ts-ignore
            adm.onStoreChange?.();
          },
          lazy: true,
        });
        // StrictMode/ConcurrentMode/Suspense may mean that our component is
        // rendered and abandoned multiple times, so we need to track leaked
        // Reactions.
      }

      useSyncExternalStore(
        admRef.current.subscribe,
        admRef.current.getSnapshot,
        admRef.current.getSnapshot
      );

      // the isInsideFunctionComponent flag is used to toggle `store` behavior
      // based on where it was called from
      isInsideFunctionComponent = true;
      try {
        // run the reactive render instead of the original one
        return admRef.current.reaction(props);
      } finally {
        isInsideFunctionComponent = false;
      }
    };
  } else {
    const BaseComp = (isStatelessComp ? Component : Comp) as ComponentClass<P>;
    // a HOC which overwrites render, shouldComponentUpdate and componentWillUnmount
    // it decides when to run the new reactive methods and when to proxy to the original methods
    class ReactiveClassComp extends BaseComp {
      state: any;
      constructor(props: P, context: any) {
        super(props, context);

        this.state = this.state || {};
        this.state[ownerComponent] = this;

        // create a reactive render for the component
        this.render = observe(this.render, {
          scheduler: () => this.setState({}),
          lazy: true,
        });
      }

      render() {
        isInsideClassComponentRender = !isStatelessComp;
        isInsideFunctionComponentWithoutHooks = isStatelessComp;
        try {
          return isStatelessComp ? (Comp as any)(this.props, this.context) : super.render();
        } finally {
          isInsideClassComponentRender = false;
          isInsideFunctionComponentWithoutHooks = false;
        }
      }

      // react should trigger updates on prop changes, while services handles store changes
      shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any) {
        const { props, state } = this;

        // respect the case when the user defines a shouldComponentUpdate
        if (super.shouldComponentUpdate) {
          return super.shouldComponentUpdate(nextProps, nextState, nextContext);
        }

        // return true if it is a reactive render or state changes
        if (state !== nextState) {
          return true;
        }

        // the component should update if any of its props shallowly changed value
        const keys = Object.keys(props);
        const nextKeys = Object.keys(nextProps);
        return (
          nextKeys.length !== keys.length ||
          // @ts-ignore
          nextKeys.some((key) => props[key] !== nextProps[key])
        );
      }

      componentWillUnmount() {
        // call user defined componentWillUnmount
        if (super.componentWillUnmount) {
          super.componentWillUnmount();
        }
        // clean up memory
        unobserve(this.render);
      }
    }

    ReactiveComp = ReactiveClassComp;
  }

  ReactiveComp.displayName = Comp.displayName || Comp.name;
  // static props are inherited by class components, but have to be copied for function components
  if (isStatelessComp) {
    Object.keys(Comp).forEach((key) => {
      // @ts-ignore
      ReactiveComp[key] = Comp[key];
    });
  }
  return (isStatelessComp && hasHooks ? memo(ReactiveComp) : ReactiveComp) as ComponentClass<P>;
}
