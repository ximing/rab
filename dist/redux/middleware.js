'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _fluxStandardAction = require('flux-standard-action');

var _constants = require('../constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function isPromise(obj) {
    return !!obj && typeof obj.then === 'function';
}
function callStartReducer(dispatch, action) {
    if (action.type) {
        dispatch({
            type: action.type,
            payload: {},
            meta: _extends({}, action.meta, _defineProperty({}, _constants.KEY.LIFECYCLE, 'start'))
        });
    }
}

exports.default = function (_ref) {
    var dispatch = _ref.dispatch,
        getState = _ref.getState;
    return function (next) {
        return function (action) {
            if (!(0, _fluxStandardAction.isFSA)(action)) {
                if (typeof action === 'function') {
                    if (isPromise(action)) {
                        callStartReducer(dispatch, action);
                        action.then(function (result) {
                            dispatch(_extends({}, action, result));
                        }, function (error) {
                            dispatch(_extends({
                                error: true
                            }, action, error));
                        });
                    } else {
                        return action(dispatch, getState);
                    }
                } else {
                    return next(action);
                }
            } else {
                if (typeof action.payload === 'function' && !isPromise(action.payload)) {
                    var res = action.payload(dispatch, getState);
                    if (isPromise(res)) {
                        callStartReducer(dispatch, action);
                        res.then(function (result) {
                            dispatch(_extends({}, action, {
                                payload: result
                            }));
                        }, function (error) {
                            dispatch(_extends({}, action, {
                                payload: error,
                                error: true
                            }));
                        });
                    } else {
                        dispatch(_extends({}, action, {
                            payload: res
                        }));
                    }
                } else {
                    if (isPromise(action.payload)) {
                        callStartReducer(dispatch, action);
                        action.payload.then(function (result) {
                            dispatch(_extends({}, action, {
                                payload: result
                            }));
                        }, function (error) {
                            dispatch(_extends({}, action, {
                                payload: error,
                                error: true
                            }));
                        });
                    } else {
                        next(action);
                    }
                }
            }
        };
    };
};