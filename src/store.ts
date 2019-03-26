/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
import { createStore, applyMiddleware, compose } from 'redux';

import rabMiddleware from './redux/middleware';

let _reduxStore = null;

export const createReduxStore = function(
    middlewares,
    initialState,
    createReducer,
    options,
    debug = false
) {
    const { routerMiddleware, extraEnhancers } = options;
    // create store
    let _middlewares = [...middlewares];
    if (routerMiddleware) {
        _middlewares = [routerMiddleware, rabMiddleware(debug), ...middlewares];
    } else {
        _middlewares = [rabMiddleware(debug), ...middlewares];
    }
    let composeFn = compose;
    // @ts-ignore
    if (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) {
        // @ts-ignore
        composeFn = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
    }
    const enhancers = [applyMiddleware(..._middlewares), ...extraEnhancers];
    _reduxStore = createStore(createReducer(), initialState, composeFn(...enhancers));

    return _reduxStore;
};

export const getReduxStore = function() {
    return _reduxStore;
};
