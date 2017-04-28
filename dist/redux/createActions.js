/**
 * Created by yeanzhi on 17/4/27.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ACTION_TYPE_DELIMITER = undefined;

var _toString2 = require('lodash/toString');

var _toString3 = _interopRequireDefault(_toString2);

var _isSymbol2 = require('lodash/isSymbol');

var _isSymbol3 = _interopRequireDefault(_isSymbol2);

var _isEmpty2 = require('lodash/isEmpty');

var _isEmpty3 = _interopRequireDefault(_isEmpty2);

var _isFunction2 = require('lodash/isFunction');

var _isFunction3 = _interopRequireDefault(_isFunction2);

var _isString2 = require('lodash/isString');

var _isString3 = _interopRequireDefault(_isString2);

exports.default = combineActions;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isString = _isString3.default;
var isFunction = _isFunction3.default;
var isEmpty = _isEmpty3.default;
var isSymbol = _isSymbol3.default;
var toString = _toString3.default;

var ACTION_TYPE_DELIMITER = exports.ACTION_TYPE_DELIMITER = '||';

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
    for (var _len = arguments.length, actionsTypes = Array(_len), _key = 0; _key < _len; _key++) {
        actionsTypes[_key] = arguments[_key];
    }

    (0, _invariant2.default)(isValidActionTypes(actionsTypes), 'Expected action types to be strings, symbols, or action creators');
    var combinedActionType = actionsTypes.map(toString).join(ACTION_TYPE_DELIMITER);
    return { toString: function toString() {
            return combinedActionType;
        } };
}