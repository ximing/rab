import React, { ComponentType } from 'react';

import { useService } from './hooks';
import { view } from './view';
import { ServiceResult } from '../types';

// @TODO 是否有更好的HOC方案？
// 更少的写法更好的类型提示
export function viewServices<SS extends Record<string, any> = {}>(services: SS) {
  return function connect<Props>(Component: ComponentType<Props>) {
    const InnerComponent: React.FC<Omit<Props, keyof SS>> = (props) => {
      const serviceProps: {
        [key in keyof SS]+?: ServiceResult<SS[key]>;
      } = {};

      (Object.keys(services) as Array<keyof SS>).forEach((key) => {
        const serviceIdentifier = Array.isArray(services[key])
          ? (services[key] as any)[0]
          : services[key];
        const options = Array.isArray(services[key]) ? (services[key] as any)[1] : undefined;
        const service = useService(serviceIdentifier, options);
        (serviceProps as any)[key] = service;
      });
      const ViewComponent = view<Props>(Component) as any;
      return <ViewComponent {...props} {...serviceProps} />;
    };
    return InnerComponent;
  };
}
// type ExtractType<O, T> = { [K in keyof O]: O[K] extends T ? O[K] : unknown };
// type Diff<T extends string, U> = ({ [P in T]: P } &
//   { [P in keyof U]: U[P] extends string ? string : never } & {
//     [x: string]: never;
//   })[T];
// type ExtractStringKey<A> = Diff<Extract<keyof A, string>, ExtractType<A, string>>;
//
// const a: any = { a: 1 };
// type a2 = typeof a;
// type a1 = Extract<keyof typeof a, string>;
