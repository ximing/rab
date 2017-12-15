/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getAction = exports.removeActions = exports.setAction = undefined;

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//all actions in models
var actions = {};

var setAction = exports.setAction = function setAction(type, action) {
    (0, _warning2.default)(!actions[type], 'action ' + type + ' init multiple times');
    actions[type] = action;
};

var removeActions = exports.removeActions = function removeActions(namespace) {
    Object.keys(actions).forEach(function (actionKey) {
        if (actionKey.indexOf(namespace) === 0) {
            delete actions[actionKey];
        }
    });
};

var getAction = exports.getAction = function getAction(type) {
    return actions[type];
};