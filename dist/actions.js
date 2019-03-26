/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var warning = require("warning");
var constants_1 = require("./constants");
//all actions in models
var actions = {};
exports.setAction = function (type, action) {
    warning(!actions[type], "action " + type + " init multiple times");
    actions[type] = action;
};
exports.removeActions = function (namespace) {
    Object.keys(actions).forEach(function (actionKey) {
        if (actionKey.indexOf("" + namespace + constants_1.SEP) === 0) {
            delete actions[actionKey];
        }
    });
};
exports.getAction = function (type) {
    return actions[type];
};
exports.clearActions = function () {
    actions = {};
};
