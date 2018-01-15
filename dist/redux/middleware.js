'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _fluxStandardAction = require('flux-standard-action');

var _constants = require('../constants');

var _lib = require('../lib');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function isPromise(obj) {
    return !!obj && typeof obj.then === 'function';
}

function callStartReducer(dispatch, action) {
    if (action.type) {
        dispatch({
            type: action.type,
            payload: action.meta['action-redux/payload'] || {},
            meta: _extends({}, action.meta, _defineProperty({}, _constants.KEY.LIFECYCLE, 'start'))
        });
    }
}

exports.default = function (debug) {
    return function (_ref) {
        var dispatch = _ref.dispatch,
            getState = _ref.getState;
        return function (next) {
            return function (action) {
                if (!(0, _fluxStandardAction.isFSA)(action)) {
                    if (typeof action === 'function') {
                        return action({ dispatch: dispatch, getState: getState, put: _lib.put, call: _lib.call });
                    } else {
                        return next(action);
                    }
                } else {
                    if (typeof action.payload === 'function' && !isPromise(action.payload)) {
                        var res = action.payload({ dispatch: dispatch, getState: getState, put: _lib.put, call: _lib.call });
                        if (isPromise(res)) {
                            callStartReducer(dispatch, action);
                            return res.then(function (result) {
                                dispatch(_extends({}, action, {
                                    payload: result
                                }));
                                return result;
                            }, function (error) {
                                dispatch(_extends({}, action, {
                                    payload: error,
                                    error: true
                                }));
                                if (debug) {
                                    throw error;
                                }
                            });
                        } else {
                            dispatch(_extends({}, action, {
                                payload: res
                            }));
                            return res;
                        }
                    } else {
                        if (isPromise(action.payload)) {
                            callStartReducer(dispatch, action);
                            return action.payload.then(function (result) {
                                dispatch(_extends({}, action, {
                                    payload: result
                                }));
                                return result;
                            }, function (error) {
                                dispatch(_extends({}, action, {
                                    payload: error,
                                    error: true
                                }));
                                if (debug) {
                                    throw error;
                                }
                            });
                        } else {
                            return next(action);
                        }
                    }
                }
            };
        };
    };
};