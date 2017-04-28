'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _isPlainObject2 = require('lodash/isPlainObject');

var _isPlainObject3 = _interopRequireDefault(_isPlainObject2);

exports.default = handleActions;

var _reduceReducers = require('reduce-reducers');

var _reduceReducers2 = _interopRequireDefault(_reduceReducers);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _handleAction = require('./handleAction');

var _handleAction2 = _interopRequireDefault(_handleAction);

var _ownKeys = require('./ownKeys');

var _ownKeys2 = _interopRequireDefault(_ownKeys);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var isPlainObject = _isPlainObject3.default;
function handleActions(handlers, defaultState) {
    (0, _invariant2.default)(isPlainObject(handlers), 'Expected handlers to be an plain object.');
    var reducers = (0, _ownKeys2.default)(handlers).map(function (type) {
        return (0, _handleAction2.default)(type, handlers[type], defaultState);
    });
    var reducer = _reduceReducers2.default.apply(undefined, _toConsumableArray(reducers));
    return function () {
        var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultState;
        var action = arguments[1];
        return reducer(state, action);
    };
}