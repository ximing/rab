"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var React = require("react");
var react_redux_1 = require("react-redux");
var redux_1 = require("redux");
var invariant = require("invariant");
var _ = require("lodash");
var connected_react_router_1 = require("connected-react-router");
var handleActions_1 = require("./redux/handleActions");
var store_1 = require("./store");
var subscription_1 = require("./subscription");
var createModel_1 = require("./createModel");
var actions_1 = require("./actions");
var isPlainObject = _.isPlainObject;
function initRab(createOpts) {
    var initialReducer = createOpts.initialReducer, defaultHistory = createOpts.defaultHistory, routerMiddleware = createOpts.routerMiddleware, setupHistory = createOpts.setupHistory;
    /**
     * Create a rab instance.
     */
    return function rab(options) {
        options = Object.assign({ simple: false }, options);
        // history and initialState does not pass to plugin
        var history = options.history || defaultHistory;
        var initialState = options.initialState || {};
        var debug = !!options.debug;
        var simpleMode = options.simple;
        delete options.simple;
        delete options.history;
        delete options.initialState;
        delete options.debug;
        var app = {
            //private member variable
            _models: [],
            _router: null,
            _store: null,
            _history: null,
            _middleware: [],
            _getProvider: null,
            //public member function
            use: use,
            addModel: addModel,
            removeModel: removeModel,
            router: router,
            registerRoot: registerRoot,
            start: start,
            destory: function () { }
        };
        return app;
        /**
         * Register middleware on the application.
         *
         * @param middleware
         */
        function use(middleware) {
            this._middleware.push(middleware);
        }
        /**
         * Register a model.
         *
         * @param model
         */
        function addModel(model) {
            model = checkModel(model);
            this._models.push(model);
            return model;
        }
        /**
         * Register a model.
         *
         * @param namespace
         */
        function removeModel(namespace) {
            actions_1.removeActions(namespace);
            this._models = this._models.filter(function (m) { return m.namespace !== namespace; });
        }
        /**
         * Config router. Takes a function with arguments { history, dispatch },
         * and expects router config. It use the same api as react-router,
         * return jsx elements or JavaScript Object for dynamic routing.
         *
         * @param router
         */
        function router(router) {
            invariant(typeof router === 'function', 'app.router: router should be function');
            this._router = router;
        }
        function registerRoot(top) {
            invariant(typeof top === 'function', 'app.top: top should be function');
            this._router = top;
        }
        /**
         * Start the app
         * @param container selector | HTMLElement
         */
        function start(container) {
            // support selector
            if (typeof container === 'string') {
                container = document.querySelector(container);
                invariant(container, "app.start: could not query selector: " + container);
            }
            invariant(!container || isHTMLElement(container), 'app.start: container should be HTMLElement');
            invariant(this._router, 'app.start: router should be defined');
            // get reducers from model
            var reducers = __assign({ router: connected_react_router_1.connectRouter(history) }, initialReducer);
            var unlisteners = {};
            this._models.forEach(function (m) {
                reducers[m.namespace] = getReducer(m.reducers, m.state);
            });
            var extraReducers = options['extraReducers'] || {};
            invariant(Object.keys(extraReducers).every(function (key) { return !(key in reducers); }), 'app.start: extraReducers is conflict with other reducers');
            var extraEnhancers = options['extraEnhancers'] || [];
            invariant(Array.isArray(extraEnhancers), 'app.start: extraEnhancers should be array');
            var createReducer = function (asyncReducers) {
                if (asyncReducers === void 0) { asyncReducers = {}; }
                return redux_1.combineReducers(__assign({}, reducers, extraReducers, asyncReducers));
            };
            // create store
            var storeOptions = {
                extraEnhancers: extraEnhancers,
                extraReducers: extraReducers,
                routerMiddleware: History
            };
            if (!simpleMode && routerMiddleware) {
                storeOptions.routerMiddleware = routerMiddleware(history);
            }
            var store = (this._store = store_1.createReduxStore(this._middleware, initialState, createReducer, storeOptions, debug));
            store.asyncReducers = {};
            // setup history
            if (!simpleMode && setupHistory) {
                setupHistory.call(this, history);
            }
            // run subscriptions
            for (var _i = 0, _a = this._models; _i < _a.length; _i++) {
                var model = _a[_i];
                if (model.subscriptions) {
                    unlisteners[model.namespace] = subscription_1.listen(model.subscriptions, app, simpleMode);
                }
            }
            //  async add model
            app.addModel = function (m) {
                m = checkModel(m);
                var store = app._store;
                if (m.reducers) {
                    store.asyncReducers[m.namespace] = getReducer(m.reducers, m.state);
                    store.replaceReducer(createReducer(store.asyncReducers));
                }
                if (m.subscriptions) {
                    unlisteners[m.namespace] = subscription_1.listen(m.subscriptions, app, simpleMode);
                }
                return m;
            };
            // async remove model
            app.removeModel = function (namespace) {
                var store = app._store;
                delete store.asyncReducers[namespace];
                delete reducers[namespace];
                actions_1.removeActions(namespace);
                store.replaceReducer(createReducer(store.asyncReducers));
                store.dispatch({ type: '@@rab.UPDATE' });
                // Unlisten subscrioptions
                subscription_1.unlisten(unlisteners, namespace);
                // Delete model from app._models
                app._models = app._models.filter(function (model) { return model.namespace !== namespace; });
            };
            // If has container, render; else, return react component
            if (container) {
                render(container, store, this, this._router);
            }
            else {
                return getProvider(store, this, this._router);
            }
            app.destory = function () {
                var store = app._store;
                Object.keys(store.asyncReducers).forEach(function (key) {
                    app.removeModel(key);
                });
                actions_1.clearActions();
                subscription_1.removeAllListener(unlisteners);
            };
        }
        // Helpers
        function getProvider(store, app, router) {
            return function (extraProps) { return (React.createElement(react_redux_1.Provider, { store: store }, !simpleMode
                ? router(__assign({ app: app, history: app._history }, extraProps))
                : router(__assign({ app: app }, extraProps)))); };
        }
        function render(container, store, app, router) {
            var ReactDOM = require('react-dom');
            ReactDOM.render(React.createElement(getProvider(store, app, router)), container);
        }
        function checkModel(m) {
            // Clone model to avoid prefixing namespace multiple times
            var model = _.cloneDeep(m);
            var namespace = model.namespace, reducers = model.reducers, actions = model.actions;
            invariant(namespace, 'app.model: namespace should be defined');
            invariant(!app._models.some(function (model) { return model.namespace === namespace; }), 'app.model: namespace should be unique');
            invariant(!model.subscriptions || isPlainObject(model.subscriptions), 'app.model: subscriptions should be Object');
            invariant(!reducers || isPlainObject(reducers), 'app.model: reducers should be Object');
            invariant(!actions || isPlainObject(actions), 'app.model: actions should be Object');
            return createModel_1.default(model);
        }
        function isHTMLElement(node) {
            return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
        }
        function getReducer(reducers, state) {
            if (Array.isArray(reducers)) {
                return reducers[1](handleActions_1.default(reducers[0], state));
            }
            else {
                return handleActions_1.default(reducers || {}, state);
            }
        }
    };
}
exports.default = initRab;
