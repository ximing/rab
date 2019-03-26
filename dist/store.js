/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var redux_1 = require("redux");
var middleware_1 = require("./redux/middleware");
var _reduxStore = null;
exports.createReduxStore = function (middlewares, initialState, createReducer, options, debug) {
    if (debug === void 0) { debug = false; }
    var routerMiddleware = options.routerMiddleware, extraEnhancers = options.extraEnhancers;
    // create store
    var _middlewares = middlewares.slice();
    if (routerMiddleware) {
        _middlewares = [routerMiddleware, middleware_1.default(debug)].concat(middlewares);
    }
    else {
        _middlewares = [middleware_1.default(debug)].concat(middlewares);
    }
    var composeFn = redux_1.compose;
    // @ts-ignore
    if (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) {
        // @ts-ignore
        composeFn = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
    }
    var enhancers = [redux_1.applyMiddleware.apply(void 0, _middlewares)].concat(extraEnhancers);
    _reduxStore = redux_1.createStore(createReducer(), initialState, composeFn.apply(void 0, enhancers));
    return _reduxStore;
};
exports.getReduxStore = function () {
    return _reduxStore;
};
