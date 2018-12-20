"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = handleAction;

var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _includes2 = _interopRequireDefault(require("lodash/includes"));

var _isPlainObject2 = _interopRequireDefault(require("lodash/isPlainObject"));

var _isNil2 = _interopRequireDefault(require("lodash/isNil"));

var _isUndefined2 = _interopRequireDefault(require("lodash/isUndefined"));

var _isFunction2 = _interopRequireDefault(require("lodash/isFunction"));

var _identity2 = _interopRequireDefault(require("lodash/identity"));

var _invariant = _interopRequireDefault(require("invariant"));

var _combineActions = require("./combineActions");

var _constants = require("../constants");

var identity = _identity2.default;
var isFunction = _isFunction2.default;
var isUndefined = _isUndefined2.default;
var isNil = _isNil2.default;
var isPlainObject = _isPlainObject2.default;
var includes = _includes2.default;

function safeMap(state, fn, action) {
  switch ((0, _typeof2.default)(fn)) {
    case 'function':
      {
        var result = fn(state, action);
        return result;
      }

    default:
      return state;
  }
}

function handleAction(type) {
  var reducer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : identity;
  var defaultState = arguments.length > 2 ? arguments[2] : undefined;
  var types = type.toString().split(_combineActions.ACTION_TYPE_DELIMITER);
  (0, _invariant.default)(!isUndefined(defaultState), "defaultState for reducer handling ".concat(types.join(', '), " should be defined"));
  (0, _invariant.default)(isFunction(reducer) || isPlainObject(reducer), 'Expected reducer to be a function or object with next and throw reducers');

  var _ref = isFunction(reducer) ? [identity, reducer, reducer, identity] : [reducer.start, reducer.next || reducer.success, reducer.throw || reducer.error, reducer.finish].map(function (aReducer) {
    return isNil(aReducer) ? identity : aReducer;
  }),
      _ref2 = (0, _slicedToArray2.default)(_ref, 4),
      startReducer = _ref2[0],
      nextReducer = _ref2[1],
      throwReducer = _ref2[2],
      finishReducer = _ref2[3];

  return function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultState;
    var action = arguments.length > 1 ? arguments[1] : undefined;
    var actionType = action.type,
        meta = action.meta;
    var lifecycle = meta ? meta[_constants.KEY.LIFECYCLE] : null;

    if (!actionType || !includes(types, actionType.toString())) {
      return state;
    }

    if (lifecycle === 'start') {
      state = safeMap(state, startReducer, action);
    } else {
      if (action.error === true && (identity === throwReducer || nextReducer === throwReducer)) {
        throw action.payload;
      }

      state = (action.error === true ? throwReducer : nextReducer)(state, action);
      state = safeMap(state, finishReducer, action);
    }

    return state;
  };
}