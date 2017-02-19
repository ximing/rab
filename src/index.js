import hashHistory from 'react-router/lib/hashHistory';
import {
  routerMiddleware,
  syncHistoryWithStore,
  routerReducer as routing,
} from 'react-router-redux';
import initRab from './initRab';
export default initRab({
  initialReducer: {
    routing,
  },
  defaultHistory: hashHistory,
  routerMiddleware,
  setupHistory(history) {
    this._history = syncHistoryWithStore(history, this._store);
  },
});