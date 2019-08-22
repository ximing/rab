import { createStore, applyMiddleware, compose, Store, combineReducers } from 'redux';
import { Rab } from './rab';

export class ReduxStore {
    private rab: Rab;
    private store: Store;
    initialState: any;

    constructor(rab: Rab) {
        this.rab = rab;
        this.initialState = {};
    }

    getReduxStore() {
        return this.store;
    }

    createReduxStore(
        middlewares,
        reducers,
        options
    ) {
        const { routerMiddleware, extraEnhancers = [], extraReducers = {} } = options;
        // create store
        let _middlewares = [...middlewares];
        if (routerMiddleware) {
            _middlewares = [routerMiddleware, ...middlewares];
        } else {
            _middlewares = [...middlewares];
        }

        const composeFn =
            typeof window === 'object' &&
            process.env.NODE_ENV !== 'production' &&
            (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
                ? (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ trace: true, maxAge: 30 })
                : compose;
        const enhancers = [applyMiddleware(..._middlewares), ...extraEnhancers];
        this.store = createStore(combineReducers({ ...reducers, ...extraReducers }), this.initialState, composeFn(...enhancers));
        return this.store;
    };
}