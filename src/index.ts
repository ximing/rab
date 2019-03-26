import { routerMiddleware } from 'connected-react-router';
import initRab from './initRab';
import { createBrowserHistory } from 'history';

import createAction from './redux/createAction';
import createActions from './redux/createActions';
import handleAction from './redux/handleAction';
import handleActions from './redux/handleActions';
import { dispatch, put, getState, call } from './lib';

export default initRab({
    initialReducer: {},
    initialActions: {},
    defaultHistory: createBrowserHistory(),
    routerMiddleware,
    setupHistory(history) {
        this._history = patchHistory(history); //syncHistoryWithStore(history, this._store);
    }
});

export {
    createAction,createActions,handleAction,handleActions,
    dispatch, put, getState, call
}

function patchHistory(history) {
    const oldListen = history.listen;
    history.listen = function(callback) {
        if (callback.name !== 'handleLocationChange') {
            callback(history.location);
        }
        return oldListen.call(history, callback);
    };
    return history;
}