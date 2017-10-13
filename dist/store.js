/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getReduxStore = exports.createReduxStore = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _redux = require('redux');

var _middleware = require('./redux/middleware');

var _middleware2 = _interopRequireDefault(_middleware);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var _reduxStore = null;

var createReduxStore = exports.createReduxStore = function createReduxStore(middlewares, initialState, reducers, options) {
    var routerMiddleware = options.routerMiddleware,
        extraEnhancers = options.extraEnhancers,
        extraReducers = options.extraReducers;
    // create store

    var _middlewares = [].concat(_toConsumableArray(middlewares));
    if (routerMiddleware) {
        _middlewares = [routerMiddleware].concat(_toConsumableArray(middlewares));
    }
    var devtools = function devtools() {
        return function (noop) {
            return noop;
        };
    };
    // if (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    //     devtools = window.__REDUX_DEVTOOLS_EXTENSION__;
    // }
    console.log('_middlewares', middlewares, routerMiddleware);
    var enhancers = [_redux.applyMiddleware.apply(undefined, [_middleware2.default].concat(_toConsumableArray(_middlewares))), devtools()].concat(_toConsumableArray(extraEnhancers));
    _reduxStore = (0, _redux.createStore)(createReducer(), initialState, _redux.compose.apply(undefined, _toConsumableArray(enhancers)));

    function createReducer() {
        return (0, _redux.combineReducers)(_extends({}, reducers, extraReducers));
    }

    return _reduxStore;
};

var getReduxStore = exports.getReduxStore = function getReduxStore() {
    return _reduxStore;
};