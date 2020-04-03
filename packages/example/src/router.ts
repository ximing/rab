import { createBrowserHistory } from 'history';
import { syncHistoryWithStore } from '@rabjs/router';

const browserHistory = createBrowserHistory();
export const history = syncHistoryWithStore(browserHistory);
