/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
import {
    createStore,
    applyMiddleware,
    compose,
    combineReducers
} from 'redux';

import rabMiddleware from './redux/middleware';

let _reduxStore = null;

export const createReduxStore = function (middlewares, initialState, reducers, options, debug = false) {
    const {routerMiddleware, extraEnhancers, extraReducers} = options;
    // create store
    let _middlewares = [...middlewares];
    if (routerMiddleware) {
        _middlewares = [routerMiddleware, ...middlewares];
    }
    let devtools = () => noop => noop;
    // if (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    //     devtools = window.__REDUX_DEVTOOLS_EXTENSION__;
    // }
    const enhancers = [
        applyMiddleware(rabMiddleware(debug), ..._middlewares),
        devtools(),
        ...extraEnhancers,
    ];
    _reduxStore = createStore(
        createReducer(),
        initialState,
        compose(...enhancers),
    );

    function createReducer() {
        return combineReducers({
            ...reducers,
            ...extraReducers
        });
    }

    return _reduxStore;
};

export const getReduxStore = function () {
    return _reduxStore;
};
