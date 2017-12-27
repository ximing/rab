/**
 * Created by yeanzhi on 17/3/9.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.put = exports.call = exports.getState = exports.dispatch = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _store = require('./store');

var _actions = require('./actions');

var dispatch = exports.dispatch = function dispatch(args) {
    if ((0, _store.getReduxStore)()) {
        return (0, _store.getReduxStore)().dispatch(args);
    } else {
        throw new Error('could not call dispatch before init store');
    }
};

var getState = exports.getState = function getState(args) {
    if ((0, _store.getReduxStore)()) {
        (0, _store.getReduxStore)().getState(args);
    } else {
        throw new Error('could not call getState before init store');
    }
};

var call = exports.call = function call(type) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
    }

    if ((0, _actions.getAction)(type)) {
        return dispatch((0, _actions.getAction)(type).apply(undefined, args));
    } else {
        return dispatch({
            type: type,
            payload: _extends({}, args)
        });
    }
};

var put = exports.put = function put(_ref) {
    var type = _ref.type,
        payload = _ref.payload;

    if ((0, _actions.getAction)(type)) {
        return dispatch((0, _actions.getAction)(type)(payload || {}));
    } else {
        return dispatch({
            type: type,
            payload: payload
        });
    }
};