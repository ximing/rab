import React from 'react';
import {
  Provider
}
from 'react-redux';
import {
  createStore,
  applyMiddleware,
  compose,
  combineReducers
}
from 'redux';
import isPlainObject from 'is-plain-object';
import invariant from 'invariant';
import warning from 'warning';
import isFunction from 'lodash.isfunction';
import handleActions from './handleActions';
import Redux, {createStore, applyMiddleware, compose} from 'redux';
import { isFSA } from 'flux-standard-action';

function isPromise (val) {
    return val && typeof val.then === 'function';
}

//()=>(dispatch, getState)=>async()=>{}
//()=>(dispatch, getState)=>{}
//()=>async(dispatch,getState)=>{}

function asyncMiddleware ({dispatch, getState}){
    return next => action =>{
        if (!isFSA(action)) {
            if (typeof action === 'function') {
                if(isPromise(action)){
                    action.then(dispatch,getState);
                }else{
                    return action(dispatch, getState);
                }
            }
            return next(action);
        }else{
            if(typeof action.payload === 'function'){
                var res = action.payload(dispatch, getState);
                if (isPromise(res)) {
                    res.then(
                        (result) => {
                            dispatch({...action, payload: result});
                        },
                        (error) => {
                            dispatch({...action, payload: error, error: true});
                        }
                    );
                }else{
                    dispatch({...action, payload: res});
                }
            }else{
                next(action);
            }
        }

    };
}


const SEP = '.';

export default function initRab(createOpts) {
  const {
    initialReducer,
    defaultHistory,
    routerMiddleware,
    setupHistory,
  } = createOpts;

  /**
   * Create a dva instance.
   */
  return function rab(hooks = {}) {
    // history and initialState does not pass to plugin
    const history = hooks.history || defaultHistory;
    const initialState = hooks.initialState || {};
    delete hooks.history;
    delete hooks.initialState;

    // //////////////////////////////////
    // Methods

    /**
     * Register middleware on the application.
     *
     * @param middleware
     */
    function use(middleware) {
      _middleware.concat(middleware);
    }

    /**
     * Register a model.
     *
     * @param model
     */
    function model(model) {
      this._models.push(checkModel(model, mobile));
    }

    // inject model dynamically
    function injectModel(createReducer, onError, unlisteners, m) {
      m = checkModel(m, mobile);
      this._models.push(m);
      const store = this._store;

      // reducers
      store.asyncReducers[m.namespace] = getReducer(m.reducers, m.state);
      store.replaceReducer(createReducer(store.asyncReducers));

      // subscriptions
      if (m.subscriptions) {
        unlisteners[m.namespace] = runSubscriptions(m.subscriptions, m, this, onError);
      }
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

    /**
     * Start the application. Selector is optional. If no selector
     * arguments, it will return a function that return JSX elements.
     *
     * @param container selector | HTMLElement
     */
    function start(container) {
      // support selector
      if (typeof container === 'string') {
        container = document.querySelector(container);
        invariant(container, `app.start: could not query selector: ${container}`);
      }

      invariant(!container || isHTMLElement(container), 'app.start: container should be HTMLElement');
      invariant(this._router, 'app.start: router should be defined');

      // error wrapper
      const onError = plugin.apply('onError', (err) => {
        throw new Error(err.stack || err);
      });
      const onErrorWrapper = (err) => {
        if (err) {
          if (typeof err === 'string') err = new Error(err);
          onError(err, app._store.dispatch);
        }
      };

      // internal model for destroy
      model.call(this, {
        namespace: '@@rab',
        state: 0,
        reducers: {
          UPDATE(state) {
            return state + 1;
          },
        },
      });

      // get reducers from model
      const reducers = {...initialReducer};
      for (const m of this._models) {
        reducers[m.namespace] = getReducer(m.reducers, m.state);
      }

      // create store
      let middlewares = this._middleware;
      if (routerMiddleware) {
        middlewares = [routerMiddleware(history), ...middlewares];
      }
      let devtools = () => noop => noop;
      if (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION__) {
        devtools = window.__REDUX_DEVTOOLS_EXTENSION__;
      }

      const createStoreWithMiddleware = compose(
          applyMiddleware(asyncMiddleware,...middlewares),
           devtools()
        )(createStore);
      const store = this._store = createStoreWithMiddleware(createReducer(),initialState);

      function createReducer() {
        return combineReducers({
          ...reducers
        })
      }

      // setup history
      if (setupHistory) setupHistory.call(this, history);

      // run subscriptions
      const unlisteners = {};
      for (const model of this._models) {
        if (model.subscriptions) {
          unlisteners[model.namespace] = runSubscriptions(model.subscriptions, model, this,
            onErrorWrapper);
        }
      }

      // inject model after start
      this.model = injectModel.bind(this, createReducer, onErrorWrapper, unlisteners);

      // If has container, render; else, return react component
      if (container) {
        render(container, store, this, this._router);
      }
      else {
        return getProvider(store, this, this._router);
      }
    }

    // Helpers

    function getProvider(store, app, router) {
      return extraProps => (
        <Provider store={store}>
          { router({ app, history: app._history, ...extraProps }) }
        </Provider>
      );
    }

    function render(container, store, app, router) {
      const ReactDOM = require('react-dom');
      ReactDOM.render(React.createElement(getProvider(store, app, router)), container);
    }

    function checkModel(m) {
      // Clone model to avoid prefixing namespace multiple times
      const model = {...m};
      const {
        namespace,
        reducers
      } = model;

      invariant(
        namespace,
        'app.model: namespace should be defined',
      );
      invariant(!app._models.some(model => model.namespace === namespace),
        'app.model: namespace should be unique',
      );
      invariant(!model.subscriptions || isPlainObject(model.subscriptions),
        'app.model: subscriptions should be Object',
      );
      invariant(!reducers || isPlainObject(reducers) || Array.isArray(reducers),
        'app.model: reducers should be Object or array',
      );
      invariant(!Array.isArray(reducers) || (isPlainObject(reducers[0]) && typeof reducers[1] === 'function'),
        'app.model: reducers with array should be app.model({ reducers: [object, function] })',
      );

      function applyNamespace(type) {
        function getNamespacedReducers(reducers) {
          return Object.keys(reducers).reduce((memo, key) => {
            warning(
              key.indexOf(`${namespace}${SEP}`) !== 0,
              `app.model: ${type.slice(0, -1)} ${key} should not be prefixed with namespace ${namespace}`,
            );
            memo[`${namespace}${SEP}${key}`] = reducers[key];
            return memo;
          }, {});
        }

        if (model[type] && type === 'reducers' && Array.isArray(model[type])) {
          model[type][0] = getNamespacedReducers(model[type][0]);
        }
      }

      applyNamespace('reducers');

      return model;
    }

    function isHTMLElement(node) {
      return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
    }

    function getReducer(reducers, state) {
      // Support reducer enhancer
      // e.g. reducers: [realReducers, enhancer]
      if (Array.isArray(reducers)) {
        return reducers[1](handleActions(reducers[0], state));
      }
      else {
        return handleActions(reducers || {}, state);
      }
    }

    function runSubscriptions(subs, model, app, onError) {
      const unlisteners = [];
      const noneFunctionSubscriptions = [];
      for (const key in subs) {
        if (Object.prototype.hasOwnProperty.call(subs, key)) {
          const sub = subs[key];
          invariant(typeof sub === 'function', 'app.start: subscription should be function');
          const unlistener = sub({
            dispatch: createDispatch(app._store.dispatch, model),
            history: app._history,
          }, onError);
          if (isFunction(unlistener)) {
            unlisteners.push(unlistener);
          }
          else {
            noneFunctionSubscriptions.push(key);
          }
        }
      }
      return {
        unlisteners,
        noneFunctionSubscriptions
      };
    }

    function prefixType(type, model) {
      const prefixedType = `${model.namespace}${SEP}${type}`;
      if ((model.reducers && model.reducers[prefixedType])) {
        return prefixedType;
      }
      return type;
    }

    function createDispatch(dispatch, model) {
      return (action) => {
        const {
          type
        } = action;
        invariant(type, 'dispatch: action should be a plain Object with type');
        warning(
          type.indexOf(`${model.namespace}${SEP}`) !== 0,
          `dispatch: ${type} should not be prefixed with namespace ${model.namespace}`,
        );
        return dispatch({...action,
          type: prefixType(type, model)
        });
      };
    }
    const app = {
      // properties
      _models: [],
      _router: null,
      _store: null,
      _history: null,
      _middleware: [],
      _getProvider: null,
      // methods
      use,
      model,
      router,
      start,
    };
    return app;
  };
}