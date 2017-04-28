'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.call = exports.getState = exports.put = exports.dispatch = exports.createModel = exports.handleActions = exports.handleAction = exports.createActions = exports.createAction = undefined;

var _router = require('../router');

var _reactRouterRedux = require('react-router-redux');

var _initRab = require('./initRab');

var _initRab2 = _interopRequireDefault(_initRab);

var _createAction2 = require('./redux/createAction');

var _createAction3 = _interopRequireDefault(_createAction2);

var _createActions2 = require('./redux/createActions');

var _createActions3 = _interopRequireDefault(_createActions2);

var _handleAction2 = require('./redux/handleAction.js');

var _handleAction3 = _interopRequireDefault(_handleAction2);

var _handleActions2 = require('./redux/handleActions.js');

var _handleActions3 = _interopRequireDefault(_handleActions2);

var _createModel2 = require('./createModel.js');

var _createModel3 = _interopRequireDefault(_createModel2);

var _lib = require('./lib');

var _lib2 = _interopRequireDefault(_lib);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.createAction = _createAction3.default;
exports.createActions = _createActions3.default;
exports.handleAction = _handleAction3.default;
exports.handleActions = _handleActions3.default;
exports.createModel = _createModel3.default;
var dispatch = _lib2.default.dispatch,
    put = _lib2.default.put,
    getState = _lib2.default.getState,
    call = _lib2.default.call;
exports.dispatch = dispatch;
exports.put = put;
exports.getState = getState;
exports.call = call;
exports.default = (0, _initRab2.default)({
    initialReducer: { routing: _reactRouterRedux.routerReducer },
    initialActions: {},
    defaultHistory: _router.browserHistory,
    routerMiddleware: _reactRouterRedux.routerMiddleware,
    setupHistory: function setupHistory(history) {
        this._history = (0, _reactRouterRedux.syncHistoryWithStore)(history, this._store);
    }
});