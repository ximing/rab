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
import {
  isFSA
}
from 'flux-standard-action';
import {
  handleActions,
  createAction
}
from 'redux-actions';

function isPromise(val) {
  return val && typeof val.then === 'function';
}

//()=>(dispatch, getState)=>async()=>{}
//()=>(dispatch, getState)=>{}
//()=>async(dispatch,getState)=>{}


const SEP = '.';

export default function initRab(createOpts) {
  const {
    initialReducer,
    initialActions,
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
      this._middleware.concat(middleware);
    }

    /**
     * Register a model.
     *
     * @param model
     */
    function model(model) {
      this._models.push(checkModel(model));
    }

    // inject model dynamically
    function injectModel(createReducer, onError, unlisteners, m) {
      m = checkModel(m);
      this._models.push(m);
      //TODO subscriptions
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
     * Start the app
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

      // get reducers from model
      const reducers = {...initialReducer};
      let actions = {};
      for (const m of this._models) {
        reducers[m.namespace] = getReducer(m.reducers, m.state);
        actions = Object.assign(actions, m.mutations);
      }
      console.log(reducers,actions);
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
        applyMiddleware(rabMiddleware(actions, reducers), ...middlewares),
        devtools()
      )(createStore);

      const store = this._store = createStoreWithMiddleware(createReducer(), initialState);

      function createReducer() {
        return combineReducers({
          ...reducers
        })
      }

      // setup history
      if (setupHistory) setupHistory.call(this, history);

      // TODO　run subscriptions

      // If has container, render; else, return react component
      if (container) {
        render(container, store, this, this._router);
      }
      else {
        return getProvider(store, this, this._router);
      }
    }

    function rabMiddleware(actions, reducers) {
      return ({
        dispatch,
        getState
      }) => {
        return next => action => {
          if (actions[action.type] && !action.handled) {
            let res = actions[action.type]({...action.payload},{dispatch, getState})
            console.log(actions[action.type],action,res,isPromise(res))
            if (isPromise(res)) {
              res.then(
                (result) => {
                  dispatch({...action,
                    payload: result,
                    handled:true
                  });
                },
                (error) => {
                  dispatch({...action,
                    payload: error,
                    error: true,
                    handled:true
                  });
                }
              );
            }
            else {
              dispatch({...action,
                payload: res,
                handled:true
              });
            }
          }
          else {
            if (!isFSA(action)) {
              if (typeof action === 'function') {
                if (isPromise(action)) {
                  action.then(dispatch, getState);
                }
                else {
                  return action(dispatch, getState);
                }
              }
              return next(action);
            }
            else {
              if (typeof action.payload === 'function') {
                var res = action.payload(dispatch, getState);
                if (isPromise(res)) {
                  res.then(
                    (result) => {
                      dispatch({...action,
                        payload: result
                      });
                    },
                    (error) => {
                      dispatch({...action,
                        payload: error,
                        error: true
                      });
                    }
                  );
                }
                else {
                  dispatch({...action,
                    payload: res
                  });
                }
              }
              else {
                next(action);
              }
            }
          }
        };
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
      const model = {...m
      };
      const {
        namespace,
        reducers,
        mutations
      } = model;

      invariant(
        namespace,
        'app.model: namespace should be defined'
      );
      invariant(!app._models.some(model => model.namespace === namespace),
        'app.model: namespace should be unique'
      );
      invariant(!model.subscriptions || isPlainObject(model.subscriptions),
        'app.model: subscriptions should be Object'
      );
      invariant(!reducers || isPlainObject(reducers),
        'app.model: reducers should be Object'
      );
      invariant(!mutations || isPlainObject(mutations),
        'app.model: reducers should be Object'
      );

      function applyNamespace(type) {
        function getNamespacedReducers(reducers) {
          return Object.keys(reducers).reduce((memo, key) => {
            warning(
              key.indexOf(`${namespace}${SEP}`) !== 0,
              `app.model: ${type.slice(0, -1)} ${key} should not be prefixed with namespace ${namespace}`
            );
            memo[`${namespace}${SEP}${key}`] = reducers[key];
            return memo;
          }, {});
        }

        function getNamespacedMutations(mutations) {
          return Object.keys(mutations).reduce((memo, key) => {
            warning(
              key.indexOf(`${namespace}${SEP}`) !== 0,
              `app.model: ${type.slice(0, -1)} ${key} should not be prefixed with namespace ${namespace}`
            );
            /*
            export let cancelShareMind = createAction(CONSTANT.CANCEL_SHARE_MIND, (fid,sid)=>async(dispatch, getState)=> {
                let mind = await api.cancelShareMind(fid,sid);
                return sid;
            });
            */
            memo[`${namespace}${SEP}${key}`] = mutations[key];//createAction(`${namespace}${SEP}${key}`, mutations[key]);
            return memo;
          }, {});
        }

        if (model[type]) {
          if (type === 'reducers') {
            model[type] = getNamespacedReducers(model[type]);
          }
          else if (type === 'mutations') {
            model[type] = getNamespacedMutations(model[type]);
          }
        }
      }

      applyNamespace('reducers');
      applyNamespace('mutations');

      return model;
    }

    function isHTMLElement(node) {
      return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
    }

    function getReducer(reducers, state) {
      //TODO Support reducer enhancer
      return handleActions(reducers || {}, state);
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