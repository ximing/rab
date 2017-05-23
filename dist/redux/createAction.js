/**
 * Created by yeanzhi on 17/4/27.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _isNull2 = require('lodash/isNull');

var _isNull3 = _interopRequireDefault(_isNull2);

var _isUndefined2 = require('lodash/isUndefined');

var _isUndefined3 = _interopRequireDefault(_isUndefined2);

var _isFunction2 = require('lodash/isFunction');

var _isFunction3 = _interopRequireDefault(_isFunction2);

var _identity2 = require('lodash/identity');

var _identity3 = _interopRequireDefault(_identity2);

exports.default = createAction;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var identity = _identity3.default;
var isFunction = _isFunction3.default;
var isUndefined = _isUndefined3.default;
var isNull = _isNull3.default;
function createAction(type) {
    var payloadCreator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : identity;
    var metaCreator = arguments[2];

    (0, _invariant2.default)(isFunction(payloadCreator) || isNull(payloadCreator), 'Expected payloadCreator to be a function, undefined or null');

    var finalPayloadCreator = isNull(payloadCreator) ? identity : payloadCreator;

    var actionCreator = function actionCreator() {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        var hasError = args[0] instanceof Error;

        var action = {
            type: type
        };

        var payload = hasError ? args[0] : finalPayloadCreator.apply(undefined, args);

        payload['action-redux/payload'] = [].concat(args);
        if (!isUndefined(payload)) {
            action.payload = payload;
        }

        if (hasError || payload instanceof Error) {
            // Handle FSA errors where the payload is an Error object. Set error.
            action.error = true;
        }

        if (isFunction(metaCreator)) {
            action.meta = metaCreator.apply(undefined, args);
        }

        return action;
    };

    actionCreator.toString = function () {
        return type.toString();
    };

    return actionCreator;
}