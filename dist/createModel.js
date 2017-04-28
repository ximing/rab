/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _isPlainObject2 = require('lodash/isPlainObject');

var _isPlainObject3 = _interopRequireDefault(_isPlainObject2);

exports.default = function (model) {
    var namespace = model.namespace,
        reducers = model.reducers,
        actions = model.actions;


    function applyNamespace(type) {
        function getNamespacedReducers(reducers) {
            return Object.keys(reducers).reduce(function (memo, key) {
                (0, _warning2.default)(key.indexOf('' + namespace + _constants.SEP) !== 0, 'app.model: ' + type.slice(0, -1) + ' ' + key + ' should not be prefixed with namespace ' + namespace);
                memo['' + namespace + _constants.SEP + key] = reducers[key];
                return memo;
            }, {});
        }

        function getNamespacedMutations(actions) {
            return Object.keys(actions).reduce(function (memo, key) {
                (0, _warning2.default)(key.indexOf('' + namespace + _constants.SEP) !== 0, 'app.model: ' + type.slice(0, -1) + ' ' + key + ' should not be prefixed with namespace ' + namespace);
                /*
                  export let cancelShareMind = createAction(CONSTANT.CANCEL_SHARE_MIND, async (fid,sid) {
                 let mind = await api.cancelShareMind(fid,sid);
                 return sid;
                 });
                  */
                memo['' + key] = (0, _createAction2.default)('' + namespace + _constants.SEP + key, actions[key]);
                (0, _actions.setAction)('' + namespace + _constants.SEP + key, memo['' + key]);

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

    (0, _invariant2.default)(namespace, 'createModel: namespace should be defined');

    (0, _invariant2.default)(!model.subscriptions || isPlainObject(model.subscriptions), 'createModel: subscriptions should be Object');
    (0, _invariant2.default)(!reducers || isPlainObject(reducers), 'createModel: reducers should be Object');
    (0, _invariant2.default)(!actions || isPlainObject(actions), 'createModel: actions should be Object');

    applyNamespace('reducers');
    applyNamespace('actions');

    return model;
};

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _createAction = require('./redux/createAction');

var _createAction2 = _interopRequireDefault(_createAction);

var _actions = require('./actions');

var _constants = require('./constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isPlainObject = _isPlainObject3.default;