import { Service } from './service';

// https://stackoverflow.com/questions/55541275/typescript-check-for-the-any-type
type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

type IsAny<T> = IfAny<T, true, false>;

// @ts-ignore
type IsUnknown<T> = any extends T ? IfAny<T, false, true> : false;

// https://stackoverflow.com/questions/55542332/typescript-conditional-type-with-discriminated-union
// @ts-ignore
type IsVoid<T> = IsAny<T> extends true ? false : [T] extends [void] ? true : false;

export interface ConstructorOf<T> {
  new (...args: any[]): T;
}

export interface ObjectOf<T> {
  [key: string]: T;
}

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

// using class type to avoid conflict with user defined params
export class ArgumentsType<_Arguments extends any[]> {}

export type PayloadMethodKeySet<M, K extends keyof M = Exclude<keyof M, keyof Service>> = {
  [key in K]: M[key] extends (...args: any[]) => Promise<any> ? key : never;
}[K];

// https://stackoverflow.com/questions/44323441/changing-property-name-in-typescript-mapped-type
// https://github.com/Microsoft/TypeScript/issues/12754
// @ts-ignore
export type ActionMethodStatesOfService<M extends Service> = {
  // [key: string]: {
  //   loading: boolean;
  //   error: Error | null;
  // };
  [key in PayloadMethodKeySet<M>]: {
    loading: boolean;
    error: Error | null;
  };
  // [key in keyof Pick<M, PayloadMethodKeySet<M, S>>]: () => ReturnType<M[key]>;
};
