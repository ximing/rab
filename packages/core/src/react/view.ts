import {
  Component,
  useState,
  useEffect,
  useMemo,
  memo,
  FC,
  ComponentType,
  ComponentClass
} from 'react';
import { observe, unobserve } from '@nx-js/observer-util';

import { hasHooks } from '../utils/helpers';
import { ownerComponent } from '../symbols';

export let isInsideFunctionComponent = false;
export let isInsideClassComponentRender = false;
export let isInsideFunctionComponentWithoutHooks = false;

// function mapStateToStores(state: any) {
//   // find store properties and map them to their none observable raw value
//   // to do not trigger none static this.setState calls
//   // from the static getDerivedStateFromProps lifecycle method
//   const component = state[ownerComponent];
//   return Object.keys(component)
//     .map((key) => component[key])
//     .filter(isObservable)
//     .map(raw);
// }

export function view<P = any, S = any>(Comp: ComponentType<P>): ComponentType<P> {
  const isStatelessComp = !Comp.prototype?.isReactComponent;

  let ReactiveComp: ComponentType<P>;
  if (isStatelessComp && hasHooks) {
    // use a hook based reactive wrapper when we can
    ReactiveComp = (props) => {
      // use a dummy setState to update the component
      const [, setState] = useState();
      // create a memoized reactive wrapper of the original component (render)
      // at the very first run of the component function
      const render = useMemo(
        () =>
          observe(Comp, {
            scheduler: () => setState({}),
            lazy: true
          }),
        // Adding the original Comp here is necessary to make React Hot Reload work
        // it does not affect behavior otherwise
        [Comp]
      ) as FC<P>;

      // cleanup the reactive connections after the very last render of the component
      useEffect(() => {
        return () => unobserve(render);
      }, []);

      // the isInsideFunctionComponent flag is used to toggle `store` behavior
      // based on where it was called from
      isInsideFunctionComponent = true;
      try {
        // run the reactive render instead of the original one
        return render(props);
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
          lazy: true
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

      // add a custom deriveStoresFromProps lifecyle method
      // static getDerivedStateFromProps(props, state) {
      //   if (super.deriveStoresFromProps) {
      //     // inject all local stores and let the user mutate them directly
      //     const stores = mapStateToStores(state);
      //     super.deriveStoresFromProps(props, ...stores);
      //   }
      //   // respect user defined getDerivedStateFromProps
      //   if (super.getDerivedStateFromProps) {
      //     return super.getDerivedStateFromProps(props, state);
      //   }
      //   return null;
      // }

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
