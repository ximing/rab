import { Draft } from 'immer';

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
type IsAny<T> = IfAny<T, true, false>;
type IsUnknown<T> = any extends T ? IfAny<T, false, true> : false;
type IsVoid<T> = IsAny<T> extends true ? false : [T] extends [void] ? true : false;

class ArgumentsType<_Arguments extends any[]> {
}

export interface ObjectOf<T> {
    [key: string]: T;
}
export interface NumericObjectOf<T> {
    [index: number]: T;
}
export declare type OriginalReducerActions<State> = ObjectOf<(state: State, payload: any) => Readonly<State>>;
export declare type OriginalImmerReducerActions<State> = ObjectOf<(state: Draft<State>, payload: any) => void>;
