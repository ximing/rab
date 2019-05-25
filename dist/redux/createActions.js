'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = combineActions;
exports.ACTION_TYPE_DELIMITER = void 0;

var _toString2 = _interopRequireDefault(require("lodash/toString"));

var _isSymbol2 = _interopRequireDefault(require("lodash/isSymbol"));

var _isEmpty2 = _interopRequireDefault(require("lodash/isEmpty"));

var _isFunction2 = _interopRequireDefault(require("lodash/isFunction"));

var _isString2 = _interopRequireDefault(require("lodash/isString"));

var _invariant = _interopRequireDefault(require("invariant"));

var isString = _isString2.default;
var isFunction = _isFunction2.default;
var isEmpty = _isEmpty2.default;
var isSymbol = _isSymbol2.default;
var toString = _toString2.default;
var ACTION_TYPE_DELIMITER = '||';
exports.ACTION_TYPE_DELIMITER = ACTION_TYPE_DELIMITER;

function isValidActionType(type) {
  return isString(type) || isFunction(type) || isSymbol(type);
}

function isValidActionTypes(types) {
  if (isEmpty(types)) {
    return false;
  }

  return types.every(isValidActionType);
}

function combineActions() {
  for (var _len = arguments.length, actionsTypes = new Array(_len), _key = 0; _key < _len; _key++) {
    actionsTypes[_key] = arguments[_key];
  }

  (0, _invariant.default)(isValidActionTypes(actionsTypes), 'Expected action types to be strings, symbols, or action creators');
  var combinedActionType = actionsTypes.map(toString).join(ACTION_TYPE_DELIMITER);
  return {
    toString: function toString() {
      return combinedActionType;
    }
  };
}