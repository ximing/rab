'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _includes2 = require('lodash/includes');

var _includes3 = _interopRequireDefault(_includes2);

var _isPlainObject2 = require('lodash/isPlainObject');

var _isPlainObject3 = _interopRequireDefault(_isPlainObject2);

var _isNil2 = require('lodash/isNil');

var _isNil3 = _interopRequireDefault(_isNil2);

var _isUndefined2 = require('lodash/isUndefined');

var _isUndefined3 = _interopRequireDefault(_isUndefined2);

var _isFunction2 = require('lodash/isFunction');

var _isFunction3 = _interopRequireDefault(_isFunction2);

var _identity2 = require('lodash/identity');

var _identity3 = _interopRequireDefault(_identity2);

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = handleAction;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _combineActions = require('./combineActions');

var _constants = require('../constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var identity = _identity3.default;
var isFunction = _isFunction3.default;
var isUndefined = _isUndefined3.default;
var isNil = _isNil3.default;
var isPlainObject = _isPlainObject3.default;
var includes = _includes3.default;


function safeMap(state, fn, action) {
  switch (typeof fn === 'undefined' ? 'undefined' : _typeof(fn)) {
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
  var defaultState = arguments[2];

  var types = type.toString().split(_combineActions.ACTION_TYPE_DELIMITER);
  (0, _invariant2.default)(!isUndefined(defaultState), 'defaultState for reducer handling ' + types.join(', ') + ' should be defined');
  (0, _invariant2.default)(isFunction(reducer) || isPlainObject(reducer), 'Expected reducer to be a function or object with next and throw reducers');

  var _ref = isFunction(reducer) ? [identity, reducer, reducer, identity] : [reducer.start, reducer.next || reducer.success, reducer.throw || reducer.error, reducer.finish].map(function (aReducer) {
    return isNil(aReducer) ? identity : aReducer;
  }),
      _ref2 = _slicedToArray(_ref, 4),
      startReducer = _ref2[0],
      nextReducer = _ref2[1],
      throwReducer = _ref2[2],
      finishReducer = _ref2[3];

  return function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultState;
    var action = arguments[1];
    var actionType = action.type,
        meta = action.meta;

    var lifecycle = meta ? meta[_constants.KEY.LIFECYCLE] : null;
    if (!actionType || !includes(types, actionType.toString())) {
      return state;
    }
    if (lifecycle === 'start') {
      state = safeMap(state, startReducer, action);
    } else {
      state = (action.error === true ? throwReducer : nextReducer)(state, action);
      state = safeMap(state, finishReducer, action);
    }
    return state;
  };
}