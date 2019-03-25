/**
 * Created by yeanzhi on 17/3/9.
 */
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var store_1 = require("./store");
var actions_1 = require("./actions");
exports.dispatch = function (args) {
    if (store_1.getReduxStore()) {
        return store_1.getReduxStore().dispatch(args);
    }
    else {
        throw new Error('could not call dispatch before init store');
    }
};
exports.getState = function (args) {
    if (store_1.getReduxStore()) {
        store_1.getReduxStore().getState(args);
    }
    else {
        throw new Error('could not call getState before init store');
    }
};
exports.call = function (type) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    if (actions_1.getAction(type)) {
        return exports.dispatch(actions_1.getAction(type).apply(void 0, args));
    }
    else {
        return exports.dispatch({
            type: type,
            payload: __assign({}, args)
        });
    }
};
exports.put = function (_a) {
    var type = _a.type, payload = _a.payload;
    if (actions_1.getAction(type)) {
        return exports.dispatch(actions_1.getAction(type)(payload || {}));
    }
    else {
        return exports.dispatch({
            type: type,
            payload: payload
        });
    }
};
