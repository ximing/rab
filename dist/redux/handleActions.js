"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = handleActions;

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _isPlainObject2 = _interopRequireDefault(require("lodash/isPlainObject"));

var _reduceReducers = _interopRequireDefault(require("reduce-reducers"));

var _invariant = _interopRequireDefault(require("invariant"));

var _handleAction = _interopRequireDefault(require("./handleAction"));

var _ownKeys = _interopRequireDefault(require("./ownKeys"));

var isPlainObject = _isPlainObject2.default;

function handleActions(handlers, defaultState) {
  (0, _invariant.default)(isPlainObject(handlers), 'Expected handlers to be an plain object.');
  var reducers = (0, _ownKeys.default)(handlers).map(function (type) {
    return (0, _handleAction.default)(type, handlers[type], defaultState);
  });

  var reducer = _reduceReducers.default.apply(void 0, (0, _toConsumableArray2.default)(reducers));

  return function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultState;
    var action = arguments.length > 1 ? arguments[1] : undefined;
    return reducer(state, action);
  };
}