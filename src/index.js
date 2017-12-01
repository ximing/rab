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
export createModel from './createModel.js';
export {dispatch, put, getState, call} from './lib';
export default initRab({
    initialReducer: {routing},
    initialActions: {},
    defaultHistory: createHistory(),
    routerMiddleware,
    setupHistory(history) {
        this._history = history;//syncHistoryWithStore(history, this._store);
    }
});
