"use strict";
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
var flux_standard_action_1 = require("flux-standard-action");
var constants_1 = require("../constants");
var lib_1 = require("../lib");
function isPromise(obj) {
    return !!obj && typeof obj.then === 'function';
}
function callStartReducer(dispatch, action) {
    var _a;
    if (action.type) {
        dispatch({
            type: action.type,
            payload: action.meta['action-redux/payload'] || {},
            meta: __assign({}, action.meta, (_a = {}, _a[constants_1.KEY.LIFECYCLE] = 'start', _a))
        });
    }
}
exports.default = (function (debug) { return function (_a) {
    var dispatch = _a.dispatch, getState = _a.getState;
    return function (next) { return function (action) {
        if (!flux_standard_action_1.isFSA(action)) {
            if (typeof action === 'function') {
                return action({ dispatch: dispatch, getState: getState, put: lib_1.put, call: lib_1.call });
            }
            else {
                return next(action);
            }
        }
        else if (typeof action.payload === 'function' && !isPromise(action.payload)) {
            var res = action.payload({ dispatch: dispatch, getState: getState, put: lib_1.put, call: lib_1.call });
            if (isPromise(res)) {
                callStartReducer(dispatch, action);
                return res.then(function (result) {
                    dispatch(__assign({}, action, { payload: result }));
                    return result;
                }, function (error) {
                    dispatch(__assign({}, action, { payload: error, error: true }));
                    if (debug) {
                        throw error;
                    }
                    else {
                        return error;
                    }
                });
            }
            else {
                return dispatch(__assign({}, action, { payload: res }));
            }
        }
        else if (isPromise(action.payload)) {
            callStartReducer(dispatch, action);
            return action.payload.then(function (result) {
                dispatch(__assign({}, action, { payload: result }));
                return result;
            }, function (error) {
                dispatch(__assign({}, action, { payload: error, error: true }));
                if (debug) {
                    throw error;
                }
                else {
                    return error;
                }
            });
        }
        else {
            next(action);
        }
    }; };
}; });
