'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _isPlainObject2 = _interopRequireDefault(require("lodash/isPlainObject"));

var _warning = _interopRequireDefault(require("warning"));

var _invariant = _interopRequireDefault(require("invariant"));

var _createAction = _interopRequireDefault(require("./redux/createAction"));

var _actions = require("./actions");

var _constants = require("./constants");

var isPlainObject = _isPlainObject2.default;

function _default(model) {
  var namespace = model.namespace,
      reducers = model.reducers,
      actions = model.actions;

  function applyNamespace(type) {
    function getNamespacedReducers(reducers) {
      return Object.keys(reducers).reduce(function (memo, key) {
        (0, _warning.default)(key.indexOf("".concat(namespace).concat(_constants.SEP)) !== 0, "app.model: ".concat(type.slice(0, -1), " ").concat(key, " should not be prefixed with namespace ").concat(namespace));
        memo["".concat(namespace).concat(_constants.SEP).concat(key)] = reducers[key];
        return memo;
      }, {});
    }

    function getNamespacedMutations(actions) {
      return Object.keys(actions).reduce(function (memo, key) {
        (0, _warning.default)(key.indexOf("".concat(namespace).concat(_constants.SEP)) !== 0, "app.model: ".concat(type.slice(0, -1), " ").concat(key, " should not be prefixed with namespace ").concat(namespace));
        memo["".concat(key)] = (0, _createAction.default)("".concat(namespace).concat(_constants.SEP).concat(key), actions[key]);
        (0, _actions.setAction)("".concat(namespace).concat(_constants.SEP).concat(key), memo["".concat(key)]);
        return memo;
      }, {});
    }

    if (model[type]) {
      if (type === 'reducers') {
        model[type] = getNamespacedReducers(model[type]);
      } else if (type === 'actions') {
        model[type] = getNamespacedMutations(model[type]);
      }
    }
  }

  (0, _invariant.default)(namespace, 'createModel: namespace should be defined');
  (0, _invariant.default)(!model.subscriptions || isPlainObject(model.subscriptions), 'createModel: subscriptions should be Object');
  (0, _invariant.default)(!reducers || isPlainObject(reducers), 'createModel: reducers should be Object');
  (0, _invariant.default)(!actions || isPlainObject(actions), 'createModel: actions should be Object');
  applyNamespace('reducers');
  applyNamespace('actions');
  return model;
}