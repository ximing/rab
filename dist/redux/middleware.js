"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _objectSpread3 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread"));

var _fluxStandardAction = require("flux-standard-action");

var _constants = require("../constants");

var _lib = require("../lib");

function isPromise(obj) {
  return !!obj && typeof obj.then === 'function';
}

function callStartReducer(dispatch, action) {
  if (action.type) {
    dispatch({
      type: action.type,
      payload: action.meta['action-redux/payload'] || {},
      meta: (0, _objectSpread3.default)({}, action.meta, (0, _defineProperty2.default)({}, _constants.KEY.LIFECYCLE, 'start'))
    });
  }
}

var _default = function _default(debug) {
  return function (_ref) {
    var dispatch = _ref.dispatch,
        getState = _ref.getState;
    return function (next) {
      return function (action) {
        if (!(0, _fluxStandardAction.isFSA)(action)) {
          if (typeof action === 'function') {
            return action({
              dispatch: dispatch,
              getState: getState,
              put: _lib.put,
              call: _lib.call
            });
          } else {
            return next(action);
          }
        } else if (typeof action.payload === 'function' && !isPromise(action.payload)) {
          var res = action.payload({
            dispatch: dispatch,
            getState: getState,
            put: _lib.put,
            call: _lib.call
          });

          if (isPromise(res)) {
            callStartReducer(dispatch, action);
            return res.then(function (result) {
              dispatch((0, _objectSpread3.default)({}, action, {
                payload: result
              }));
              return result;
            }, function (error) {
              dispatch((0, _objectSpread3.default)({}, action, {
                payload: error,
                error: true
              }));

              if (debug) {
                throw error;
              } else {
                return error;
              }
            });
          } else {
            return dispatch((0, _objectSpread3.default)({}, action, {
              payload: res
            }));
          }
        } else if (isPromise(action.payload)) {
          callStartReducer(dispatch, action);
          return action.payload.then(function (result) {
            dispatch((0, _objectSpread3.default)({}, action, {
              payload: result
            }));
            return result;
          }, function (error) {
            dispatch((0, _objectSpread3.default)({}, action, {
              payload: error,
              error: true
            }));

            if (debug) {
              throw error;
            } else {
              return error;
            }
          });
        } else {
          next(action);
        }
      };
    };
  };
};

exports.default = _default;