import { browserHistory } from 'react-router';
import {
  routerMiddleware,
  syncHistoryWithStore,
  routerReducer as routing
} from 'react-router-redux';
import initRab from './initRab';
import {call} from './lib';
initRab.call = call;
export default initRab({
    initialReducer: {routing},
    initialActions:{},
    defaultHistory: browserHistory,
    routerMiddleware,
    setupHistory(history) {
        this._history = syncHistoryWithStore(history, this._store);
    }
});
