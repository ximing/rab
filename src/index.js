import {
    routerReducer as routing,
    routerMiddleware
} from 'react-router-redux';
import initRab from './initRab';
import createHistory from 'history/createBrowserHistory';

export createAction from './redux/createAction';
export createActions from './redux/createActions';
export handleAction from './redux/handleAction.js';
export handleActions from './redux/handleActions.js';
export {dispatch, put, getState, call} from './lib';
export default initRab({
    initialReducer: {routing},
    initialActions: {},
    defaultHistory: createHistory(),
    routerMiddleware,
    setupHistory(history) {
        this._history = patchHistory(history);//syncHistoryWithStore(history, this._store);
    }
});

function patchHistory(history) {
    const oldListen = history.listen;
    history.listen = (callback) => {
        callback(history.location);
        return oldListen.call(history, callback);
    };
    return history;
}
