import { Draft } from 'immer';
import { Observable } from 'rxjs';
import { Model } from './model';

export type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
export type IsAny<T> = IfAny<T, true, false>;
export type IsUnknown<T> = any extends T ? IfAny<T, false, true> : false;
export type IsVoid<T> = IsAny<T> extends true ? false : [T] extends [void] ? true : false;

export class ArgumentsType<_Arguments extends any[]> {
}

export interface ObjectOf<T> {
    [key: string]: T;
}

export interface NumericObjectOf<T> {
    [index: number]: T;
}

export declare type OriginalReducerActions<State> = ObjectOf<(state: State, payload: any) => Readonly<State>>;
export declare type OriginalImmerReducerActions<State> = ObjectOf<(state: Draft<State>, payload: any) => void>;
export type UnpackReducerPayload<Func, State> = Func extends (() => State) ? ArgumentsType<[void]> : Func extends (state: State, payload: infer P) => State ? ArgumentsType<[IsUnknown<P> extends true ? void : P]> : never;
export type UnpackImmerReducerPayload<Func, State> = Func extends (state: Draft<State>, payload: infer P) => void ? ArgumentsType<[IsUnknown<P> extends true ? void : P]> : never;
export type UnpackDefineActionPayload<OB> = OB extends Observable<infer P> ? ArgumentsType<[P]> : never;
export type UnpackPayload<F, S> = UnpackReducerPayload<F, S> extends never ? UnpackImmerReducerPayload<F, S> extends never ? UnpackDefineActionPayload<F> : UnpackImmerReducerPayload<F, S> : UnpackReducerPayload<F, S>;

export interface ModelAction {
    readonly model: Model<any>;
    readonly namespace: string;
    readonly actionName: string;
    readonly params: any;
}
export interface ReducerAction {
    readonly type: string;
    readonly namespace: string;
    readonly actionName: string;
    readonly params: any;
}