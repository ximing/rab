import { routerMiddleware } from 'connected-react-router';
import initRab from './initRab';
import { createBrowserHistory } from 'history';

export createAction from './redux/createAction';
export createActions from './redux/createActions';
export handleAction from './redux/handleAction.js';
export handleActions from './redux/handleActions.js';
export { dispatch, put, getState, call } from './lib';

export default initRab({
    initialReducer: {},
    initialActions: {},
    defaultHistory: createBrowserHistory(),
    routerMiddleware,
    setupHistory(history) {
        this._history = patchHistory(history); //syncHistoryWithStore(history, this._store);
    }
});

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
