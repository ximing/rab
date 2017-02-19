import 'babel-polyfill';

import React from 'react';
import rab, { connect } from '../index.js';
import { Router, Route } from '../router';
function stop(time){
  return new Promise((res,rej)=>{
    setTimeout(function(){res()},2000);
  })
}
const app = rab();
// 2. Model
app.model({
  namespace: 'count',
  state: 0,
  reducers: {
    add(count) { return count + 1; },
    minus(count) { return count - 1; },
    asyncAdd(count) { return count + 1; }
  },
  mutations:{
    async asyncAdd({},{}){
      await stop();
    }
  }
});

// 3. View
const App = connect(({ count }) => ({
  count,
}))((props) => {
  return (
    <div>
      <h2>{ props.count }</h2>
      <button key="add" onClick={() => { props.dispatch({type: 'count.add' }); }}>+</button>
      <button key="minus" onClick={() => { props.dispatch({type: 'count.minus' }); }}>-</button>
      <button key="async" onClick={() => { props.dispatch({type: 'count.asyncAdd' }); }}>ASYNC ADD</button>
    </div>
  );
});

// 4. Router
app.router(({ history }) => {
  return (
    <Router history={history}>
      <Route path="/" component={App} />
    </Router>
  );
});

// 5. Start
app.start('#demo_container');