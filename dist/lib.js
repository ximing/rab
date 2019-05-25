'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.put = exports.call = exports.getState = exports.dispatch = void 0;

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread"));

var _store = require("./store");

var _actions = require("./actions");

var dispatch = function dispatch(args) {
  if ((0, _store.getReduxStore)()) {
    return (0, _store.getReduxStore)().dispatch(args);
  } else {
    throw new Error('could not call dispatch before init store');
  }
};

exports.dispatch = dispatch;

var getState = function getState(args) {
  if ((0, _store.getReduxStore)()) {
    return (0, _store.getReduxStore)().getState(args);
  } else {
    throw new Error('could not call getState before init store');
  }
};

exports.getState = getState;

var call = function call(type) {
  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  if ((0, _actions.getAction)(type)) {
    return dispatch((0, _actions.getAction)(type).apply(void 0, args));
  } else {
    return dispatch({
      type: type,
      payload: (0, _objectSpread2.default)({}, args)
    });
  }
};

exports.call = call;

var put = function put(_ref) {
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

exports.put = put;