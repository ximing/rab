/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
import {
    createStore,
    applyMiddleware,
    compose
} from 'redux';

import rabMiddleware from './redux/middleware';

let _reduxStore = null;

export const createReduxStore = function (middlewares, initialState, initialReducer, options, debug = false) {
    const {routerMiddleware, extraEnhancers} = options;
    // create store
    let _middlewares = [...middlewares];
    if (routerMiddleware) {
        _middlewares = [routerMiddleware, ...middlewares];
    }
    let devtools = () => noop => noop;
    if (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION__) {
        devtools = window.__REDUX_DEVTOOLS_EXTENSION__;
    }
    const enhancers = [
        applyMiddleware(rabMiddleware(debug), ..._middlewares),
        devtools(window.__REDUX_DEVTOOLS_EXTENSION__OPTIONS),
        ...extraEnhancers
    ];
    console.log('create store', initialState)
    _reduxStore = createStore(
        initialReducer,
        initialState,
        compose(...enhancers),
    );

    return _reduxStore;
};

export const getReduxStore = function () {
    return _reduxStore;
};
