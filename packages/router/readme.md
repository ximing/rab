# mobx-react-router

Keep your rabjs state in sync with react-router via a `RouterService`.

Router location state is **observable**
components will cause the component to re-render when the location changes.

Very much inspired by (and copied from) [mobx-react-router](https://github.com/alisd23/mobx-react-router).

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
  - [RouterStore](#routerstore)
  - [syncHistoryWithStore](#synchistorywithstorehistory-store)

This branch (master) is for use with **react-router v4**.

If you're looking for the bindings for use with react-router `v3` go to [the v3 branch](https://github.com/alisd23/mobx-react-router/tree/v3).

## Installation

```
npm install --save @rabjs/router
```

And if you haven't installed all the peer dependencies, you should probably do that now:

```bash
npm install --save @rabjs/core react-router
```

## Usage

`index.js`

```jsx harmony
import React from 'react';
import ReactDOM from 'react-dom';
import createBrowserHistory from 'history/createBrowserHistory';
import { syncHistoryWithStore } from '@rabjs/router';
import { Router } from 'react-router';
import App from './App';

const browserHistory = createBrowserHistory();
const history = syncHistoryWithStore(browserHistory);

ReactDOM.render(
  <Router history={history}>
    <App />
  </Router>,
  document.getElementById('root')
);
```

`App.js`

```jsx harmony
import React, { Component } from 'react';
import { view, useService } from '@rabjs/core';
import { RouterService } from '@rabjs/router';

export const App = view(() => {
  const routerService = useService(RouterService);
  const { location, push, goBack } = routerService;
  return (
    <div>
      <span>Current pathname: {location.pathname}</span>
      <button onClick={() => push('/test')}>Change url</button>
      <button onClick={() => goBack()}>Go Back</button>
    </div>
  );
});
```

### Typescript

If you are using typescript - the built in typings for this project depend on
`@types/history`, so make sure you have them installed too.

## Troubleshooting

**Routes not updating correctly when URL changes**

There is a known issue with React Router 4 and MobX (and Redux) where "blocker" components like those
created by `@observer` (and `@connect` in Redux) block react router updates from propagating down the
component tree.

There is a React Router 4 documentation page for information on this issue:

https://github.com/ReactTraining/react-router/blob/master/packages/react-router/docs/guides/blocked-updates.md

To fix problems like this, try wrapping components which are being "blocked" with React Router's `withRouter` higher
order component should help, depending on the case.

Refer to the link above for more information on this solution, and some alternatives.

## API

### RouterService

A **router service** instance has the following properties:

- `location` (_observable_) - history [location object](https://github.com/mjackson/history#listening)
- `history` - raw [history API](https://github.com/mjackson/history#properties) object

And the following [history methods](https://github.com/mjackson/history#navigation):

- **push(_path_)**
- **replace(_path_)**
- **go(_n_)**
- **goBack()**
- **goForward()**

### syncHistoryWithStore(_history_)

- `history` - A variant of a history object, usually `browserHistory`

returns an _enhanced_ history object with the following **additional methods**:

- **subscribe(_listener_)**  
  Subscribes to any changes in the store's `location` observable  
  **Returns** an unsubscribe function which destroys the listener

```js
const unsubscribeFromStore = history.subscribe((location, action) =>
  console.log(location.pathname)
);

history.push('/test1');
unsubscribeFromStore();
history.push('/test2');

// Logs
// 'test1'
```

- **unsubscribe()**  
  Un-syncs the store from the history. The store will **no longer update** when the history changes

```js
history.unsubscribe();
// Store no longer updates
```
