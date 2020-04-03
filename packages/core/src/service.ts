import 'reflect-metadata';
import { injectable, postConstruct } from 'inversify';
import produce from 'immer';
import { ActionsSymbol, StateSymbol } from './symbols';
import { getOriginalFunctions } from './utils/getOriginalFunctions';
import {
    ActionMethodOfService,
    OriginalEffectActions,
    OriginalImmerReducerActions,
    OriginalReducerActions,
    subscribeFunction,
    TriggerActions
} from './types';
import { BaseState } from './baseState';

@injectable()
export abstract class Service<State> {
    abstract defaultState: Readonly<State>;

    private get state(): BaseState<State> {
        if (!Reflect.hasMetadata(StateSymbol, this)) {
            throw new Error(
                `Store is destroyed or not created currently, ${this.constructor.name}`
            );
        }
        return Reflect.getMetadata(StateSymbol, this);
    }

    getActions<M extends Service<State>>(this: M): ActionMethodOfService<M, State> {
        if (!Reflect.hasMetadata(ActionsSymbol, this)) {
            throw new Error(
                `Store is destroyed or not created currently, ${this.constructor.name}`
            );
        }
        return Reflect.getMetadata(ActionsSymbol, this);
    }

    getState() {
        return this.state.getState();
    }

    dispatch(name: string, state: State) {
        console.log('dispatch', name);
        return this.state.setState(state);
    }

    destory() {
        this.state.destory();
    }

    subscribe(fn: subscribeFunction<State>) {
        return this.state.subscribe(fn);
    }

    private setupEffectActions<State>(
        effectActions: OriginalEffectActions<State>,
        state: BaseState<State>
    ): TriggerActions {
        const actions: TriggerActions = {};
        Object.keys(effectActions).forEach((actionName) => {
            const effect = effectActions[actionName];
            actions[actionName] = async (params: any) => {
                return await effect(params, state.getState());
            };
        });
        return actions;
    }

    private setupReducerActions<State>(
        reducerActions: OriginalReducerActions<State>,
        state: BaseState<State>
    ): TriggerActions {
        const actions: TriggerActions = {};
        Object.keys(reducerActions).forEach((actionName) => {
            const reducer = reducerActions[actionName];
            actions[actionName] = (params: any) => {
                const nextState = reducer(state.getState(), params);
                // @ts-ignore
                this.state.setState(nextState);
            };
        });
        return actions;
    }

    private setupImmerReducerActions<State>(
        immerReducerActions: OriginalImmerReducerActions<State>,
        state: BaseState<State>
    ): TriggerActions {
        const actions: TriggerActions = {};
        Object.keys(immerReducerActions).forEach((actionName) => {
            const immerReducer = immerReducerActions[actionName];
            actions[actionName] = (params: any) => {
                const nextState = produce(state.getState(), (draft) => {
                    immerReducer(draft, params);
                });
                // @ts-ignore
                this.state.setState(nextState);
            };
        });
        return actions;
    }

    @postConstruct()
    __init__() {
        const state = new BaseState(this.defaultState);
        const { effects, reducers, immerReducers } = getOriginalFunctions(this);
        const reducerActions = this.setupReducerActions(reducers, state);
        const immerReducerActions = this.setupImmerReducerActions(immerReducers, state);
        const effectActions = this.setupEffectActions(effects, state);
        Reflect.defineMetadata(StateSymbol, state, this);
        Reflect.defineMetadata(
            ActionsSymbol,
            {
                ...reducerActions,
                ...immerReducerActions,
                ...effectActions
            },
            this
        );
    }
}
