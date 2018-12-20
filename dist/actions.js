'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAction = exports.removeActions = exports.setAction = void 0;

var _warning = _interopRequireDefault(require("warning"));

var _constants = require("./constants");

var actions = {};

var setAction = function setAction(type, action) {
  (0, _warning.default)(!actions[type], "action ".concat(type, " init multiple times"));
  actions[type] = action;
};

exports.setAction = setAction;

var removeActions = function removeActions(namespace) {
  Object.keys(actions).forEach(function (actionKey) {
    if (actionKey.indexOf("".concat(namespace).concat(_constants.SEP)) === 0) {
      delete actions[actionKey];
    }
  });
};

exports.removeActions = removeActions;

var getAction = function getAction(type) {
  return actions[type];
};

exports.getAction = getAction;