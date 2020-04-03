import { Draft } from 'immer';
import { Service } from './service';

// https://stackoverflow.com/questions/55541275/typescript-check-for-the-any-type
type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

type IsAny<T> = IfAny<T, true, false>;

type IsUnknown<T> = any extends T ? IfAny<T, false, true> : false;

// https://stackoverflow.com/questions/55542332/typescript-conditional-type-with-discriminated-union
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

export type ActionMethod<
    T extends ArgumentsType<any[]> | never,
    R = void
> = T extends ArgumentsType<infer Arguments>
    ? IsVoid<Arguments[0]> extends true
        ? () => R
        : Extract<Arguments[0], undefined> extends never
        ? (params: Arguments[0]) => R
        : (params?: Arguments[0]) => R
    : (params: T) => R;

type UnpackReducerPayload<Func, State> = Func extends () => State
    ? ArgumentsType<[void]>
    : Func extends (state: State, payload: infer P) => State
    ? ArgumentsType<[IsUnknown<P> extends true ? void : P]>
    : never;

type UnpackImmerReducerPayload<Func, State> = Func extends (
    state: Draft<State>,
    payload: infer P
) => void
    ? ArgumentsType<[IsUnknown<P> extends true ? void : P]>
    : never;

type UnpackEffectPayload<Func, State> = Func extends () => Promise<any>
    ? ArgumentsType<[void]>
    : Func extends
          | ((payload: infer P) => Promise<any>)
          | ((payload: infer P, state: State) => Promise<any>)
    ? ArgumentsType<[P]>
    : never;

type UnpackPayload<F, S> = UnpackEffectPayload<F, S> extends never
    ? UnpackReducerPayload<F, S> extends never
        ? UnpackImmerReducerPayload<F, S>
        : UnpackReducerPayload<F, S>
    : UnpackEffectPayload<F, S>;

type PayloadMethodKeySet<M, S, K extends keyof M = Exclude<keyof M, keyof Service<S>>> = {
    [key in K]: M[key] extends
        | (() => Promise<any>)
        | ((payload: any) => Promise<any>)
        | ((payload: any, state: S) => Promise<any>)
        | (() => S)
        | ((state: S) => S)
        | ((state: S, payload: any) => S)
        | ((state: Draft<S>) => void)
        | ((state: Draft<S>, payload: any) => void)
        ? key
        : never;
}[K];

// export type ActionMethodOfService<M extends Service<S>, S> = {
//     [key in keyof Pick<M, PayloadMethodKeySet<M, S>>]: ActionMethod<UnpackPayload<M[key], S>>;
// };

// export type ActionMethodOfService<M extends Service<S>, S> = {
//     [key in keyof M]: ActionMethod<UnpackPayload<M[key], S>, ReturnType<M[key]>>;
// };
export type ActionMethodOfService<M extends Service<S>, S> = {
    [key in keyof Pick<M, PayloadMethodKeySet<M, S>>]: ActionMethod<
        UnpackPayload<M[key], S>,
        ReturnType<M[key]>
    >;
    // [key in keyof Pick<M, PayloadMethodKeySet<M, S>>]: () => ReturnType<M[key]>;
};
// export type ActionMethodOfService<M extends Service<S>, S> = Pick<
//     {
//         [key in keyof M]: ActionMethod<UnpackPayload<M[key], S>, ReturnType<any>>;
//     },
//     PayloadMethodKeySet<M, S>
// >;

export type OriginalEffectActions<State> = ObjectOf<
    (payload: any, state: Readonly<State>) => Promise<any>
>;

export type OriginalReducerActions<S> = ObjectOf<(state: S, payload: any) => S>;

export type OriginalImmerReducerActions<S> = ObjectOf<(state: Draft<S>, payload: any) => void>;

export type TriggerActions = ObjectOf<ActionMethod<any>>;

export type subscribeFunction<State> = (state: State) => void;
