import { Draft } from 'immer';
import { injectable } from 'inversify';
import { defineActionSymbols } from './symbols';
import { ArgumentsType, IsVoid, UnpackPayload } from './interfaces';

type PayloadMethodKeySet<M, S, SS extends keyof M = Exclude<keyof M, keyof Model<S>>> = {
    [key in SS]: M[key] extends (() => Promise<any>) | ((payload: any) => Promise<any>) | (() => S) | ((state: S) => S) | ((state: S, payload: any) => S) | ((state: Draft<S>) => void) | ((state: Draft<S>, payload: any) => void) ? key : never;
}[SS];
type ActionMethod<T extends ArgumentsType<any[]> | never, R = void> = T extends ArgumentsType<infer Arguments> ? IsVoid<Arguments[0]> extends true ? () => R : Extract<Arguments[0], undefined> extends never ? (params: Arguments[0]) => R : (params?: Arguments[0]) => R : (params: T) => R;

type ActionOfService<M extends Model<S>, S> = Pick<{
    [key in keyof M]: ActionMethod<UnpackPayload<M[key], S>, S | void | Promise<any>>;
}, PayloadMethodKeySet<M, S>>;

@injectable()
export class Model<State> {
    protected readonly state: State;
    getActions: <M extends Model<State>>(this: M) => M extends Model<infer S> ? ActionOfService<M, S> : never;

    constructor() {
        this.getActions = () => {
            const actions = Reflect.getMetadata(defineActionSymbols.decorator, this) || {};
            return actions;
        };
    }

    getState(): State {
        return this.state;
    }

    destory() {
    }
}

export interface IModel<S> {
    new(): Model<S>;
}