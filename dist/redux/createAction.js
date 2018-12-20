'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createAction;

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread"));

var _isNull2 = _interopRequireDefault(require("lodash/isNull"));

var _isUndefined2 = _interopRequireDefault(require("lodash/isUndefined"));

var _isFunction2 = _interopRequireDefault(require("lodash/isFunction"));

var _identity2 = _interopRequireDefault(require("lodash/identity"));

var _invariant = _interopRequireDefault(require("invariant"));

var identity = _identity2.default;
var isFunction = _isFunction2.default;
var isUndefined = _isUndefined2.default;
var isNull = _isNull2.default;

function createAction(type) {
  var payloadCreator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : identity;
  var metaCreator = arguments.length > 2 ? arguments[2] : undefined;
  (0, _invariant.default)(isFunction(payloadCreator) || isNull(payloadCreator), 'Expected payloadCreator to be a function, undefined or null');
  var finalPayloadCreator = isNull(payloadCreator) ? identity : payloadCreator;

  var actionCreator = function actionCreator() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var hasError = args[0] instanceof Error;
    var action = {
      type: type,
      meta: {
        'action-redux/payload': [].concat(args)
      }
    };
    var payload = hasError ? args[0] : finalPayloadCreator.apply(void 0, args);

    if (!isUndefined(payload)) {
      action.payload = payload;
    }

    if (hasError || payload instanceof Error) {
      action.error = true;
    }

    if (isFunction(metaCreator)) {
      action.meta = Object.assign(action.meta, (0, _objectSpread2.default)({}, metaCreator.apply(void 0, args)));
    }

    return action;
  };

  actionCreator.toString = function () {
    return type.toString();
  };

  return actionCreator;
}