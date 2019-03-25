/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var warning = require("warning");
var invariant = require("invariant");
var _ = require("lodash");
var createAction_1 = require("./redux/createAction");
var actions_1 = require("./actions");
var constants_1 = require("./constants");
var isPlainObject = _.isPlainObject;
function default_1(model) {
    var namespace = model.namespace, reducers = model.reducers, actions = model.actions;
    function applyNamespace(type) {
        function getNamespacedReducers(reducers) {
            return Object.keys(reducers).reduce(function (memo, key) {
                warning(key.indexOf("" + namespace + constants_1.SEP) !== 0, "app.model: " + type.slice(0, -1) + " " + key + " should not be prefixed with namespace " + namespace);
                memo["" + namespace + constants_1.SEP + key] = reducers[key];
                return memo;
            }, {});
        }
        function getNamespacedMutations(actions) {
            return Object.keys(actions).reduce(function (memo, key) {
                warning(key.indexOf("" + namespace + constants_1.SEP) !== 0, "app.model: " + type.slice(0, -1) + " " + key + " should not be prefixed with namespace " + namespace);
                memo["" + key] = createAction_1.default("" + namespace + constants_1.SEP + key, actions[key]);
                actions_1.setAction("" + namespace + constants_1.SEP + key, memo["" + key]);
                return memo;
            }, {});
        }
        if (model[type]) {
            if (type === 'reducers') {
                model[type] = getNamespacedReducers(model[type]);
            }
            else if (type === 'actions') {
                model[type] = getNamespacedMutations(model[type]);
            }
        }
    }
    invariant(namespace, 'createModel: namespace should be defined');
    invariant(!model.subscriptions || isPlainObject(model.subscriptions), 'createModel: subscriptions should be Object');
    invariant(!reducers || isPlainObject(reducers), 'createModel: reducers should be Object');
    invariant(!actions || isPlainObject(actions), 'createModel: actions should be Object');
    applyNamespace('reducers');
    applyNamespace('actions');
    return model;
}
exports.default = default_1;
