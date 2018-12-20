"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = initRab;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread"));

var _cloneDeep2 = _interopRequireDefault(require("lodash/cloneDeep"));

var _isPlainObject2 = _interopRequireDefault(require("lodash/isPlainObject"));

var _react = _interopRequireDefault(require("react"));

var _reactRedux = require("react-redux");

var _redux = require("redux");

var _invariant = _interopRequireDefault(require("invariant"));

var _handleActions = _interopRequireDefault(require("./redux/handleActions"));

var _store = require("./store");

var _subscription = require("./subscription");

var _createModel = _interopRequireDefault(require("./createModel"));

var _actions = require("./actions");

var _connectedReactRouter = require("connected-react-router");

var isPlainObject = _isPlainObject2.default;

function initRab(createOpts) {
  var initialReducer = createOpts.initialReducer,
      defaultHistory = createOpts.defaultHistory,
      routerMiddleware = createOpts.routerMiddleware,
      setupHistory = createOpts.setupHistory;
  return function rab() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    options = Object.assign({
      simple: false
    }, options);
    var history = options.history || defaultHistory;
    var initialState = options.initialState || {};
    var debug = !!options.debug;
    var simpleMode = options.simple;
    delete options.simple;
    delete options.history;
    delete options.initialState;
    delete options.debug;
    var app = {
      _models: [],
      _router: null,
      _store: null,
      _history: null,
      _middleware: [],
      _getProvider: null,
      use: use,
      addModel: addModel,
      removeModel: removeModel,
      router: router,
      registerRoot: registerRoot,
      start: start
    };
    return app;

    function use(middleware) {
      this._middleware.push(middleware);
    }

    function addModel(model) {
      model = checkModel(model);

      this._models.push(model);

      return model;
    }

    function removeModel(namespace) {
      (0, _actions.removeActions)(namespace);
      this._models = this._models.filter(function (m) {
        return m.namespace !== namespace;
      });
    }

    function router(router) {
      (0, _invariant.default)(typeof router === 'function', 'app.router: router should be function');
      this._router = router;
    }

    function registerRoot(top) {
      (0, _invariant.default)(typeof top === 'function', 'app.top: top should be function');
      this._router = top;
    }

    function start(container) {
      if (typeof container === 'string') {
        container = document.querySelector(container);
        (0, _invariant.default)(container, "app.start: could not query selector: ".concat(container));
      }

      (0, _invariant.default)(!container || isHTMLElement(container), 'app.start: container should be HTMLElement');
      (0, _invariant.default)(this._router, 'app.start: router should be defined');
      var reducers = (0, _objectSpread2.default)({
        router: (0, _connectedReactRouter.connectRouter)(history)
      }, initialReducer);
      var unlisteners = {};

      this._models.forEach(function (m) {
        reducers[m.namespace] = getReducer(m.reducers, m.state);
      });

      var extraReducers = options['extraReducers'] || {};
      (0, _invariant.default)(Object.keys(extraReducers).every(function (key) {
        return !(key in reducers);
      }), 'app.start: extraReducers is conflict with other reducers');
      var extraEnhancers = options['extraEnhancers'] || [];
      (0, _invariant.default)(Array.isArray(extraEnhancers), 'app.start: extraEnhancers should be array');

      var createReducer = function createReducer() {
        var asyncReducers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        return (0, _redux.combineReducers)((0, _objectSpread2.default)({}, reducers, extraReducers, asyncReducers));
      };

      var storeOptions = {
        extraEnhancers: extraEnhancers,
        extraReducers: extraReducers
      };

      if (!simpleMode && routerMiddleware) {
        storeOptions.routerMiddleware = routerMiddleware(history);
      }

      var store = this._store = (0, _store.createReduxStore)(this._middleware, initialState, createReducer, storeOptions, debug);
      store.asyncReducers = {};

      if (!simpleMode && setupHistory) {
        setupHistory.call(this, history);
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this._models[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var model = _step.value;

          if (model.subscriptions) {
            unlisteners[model.namespace] = (0, _subscription.listen)(model.subscriptions, app, simpleMode);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      app.addModel = function (m) {
        m = checkModel(m);
        var store = app._store;

        if (m.reducers) {
          store.asyncReducers[m.namespace] = getReducer(m.reducers, m.state);
          store.replaceReducer(createReducer(store.asyncReducers));
        }

        if (m.subscriptions) {
          unlisteners[m.namespace] = (0, _subscription.listen)(m.subscriptions, app, simpleMode);
        }

        return m;
      };

      app.removeModel = function (namespace) {
        var store = app._store;
        delete store.asyncReducers[namespace];
        delete reducers[namespace];
        (0, _actions.removeActions)(namespace);
        store.replaceReducer(createReducer(store.asyncReducers));
        store.dispatch({
          type: '@@rab.UPDATE'
        });
        (0, _subscription.unlisten)(unlisteners, namespace);
        app._models = app._models.filter(function (model) {
          return model.namespace !== namespace;
        });
      };

      if (container) {
        render(container, store, this, this._router);
      } else {
        return getProvider(store, this, this._router);
      }
    }

    function getProvider(store, app, router) {
      return function (extraProps) {
        return _react.default.createElement(_reactRedux.Provider, {
          store: store
        }, !simpleMode ? router((0, _objectSpread2.default)({
          app: app,
          history: app._history
        }, extraProps)) : router((0, _objectSpread2.default)({
          app: app
        }, extraProps)));
      };
    }

    function render(container, store, app, router) {
      var ReactDOM = require('react-dom');

      ReactDOM.render(_react.default.createElement(getProvider(store, app, router)), container);
    }

    function checkModel(m) {
      var model = (0, _cloneDeep2.default)(m);
      var namespace = model.namespace,
          reducers = model.reducers,
          actions = model.actions;
      (0, _invariant.default)(namespace, 'app.model: namespace should be defined');
      (0, _invariant.default)(!app._models.some(function (model) {
        return model.namespace === namespace;
      }), 'app.model: namespace should be unique');
      (0, _invariant.default)(!model.subscriptions || isPlainObject(model.subscriptions), 'app.model: subscriptions should be Object');
      (0, _invariant.default)(!reducers || isPlainObject(reducers), 'app.model: reducers should be Object');
      (0, _invariant.default)(!actions || isPlainObject(actions), 'app.model: actions should be Object');
      return (0, _createModel.default)(model);
    }

    function isHTMLElement(node) {
      return (0, _typeof2.default)(node) === 'object' && node !== null && node.nodeType && node.nodeName;
    }

    function getReducer(reducers, state) {
      if (Array.isArray(reducers)) {
        return reducers[1]((0, _handleActions.default)(reducers[0], state));
      } else {
        return (0, _handleActions.default)(reducers || {}, state);
      }
    }
  };
}