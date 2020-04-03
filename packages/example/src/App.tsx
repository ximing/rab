import 'reflect-metadata';
import React from 'react';
import { usePrevious } from 'react-use';
import './App.css';
import { view, useService } from '@rabjs/core';
import { CountService } from './count';
import { Demo } from './modules/demo/demo';
import { DemoFC } from './modules/demo/demoFC';
import { Link, Switch, Route } from 'react-router-dom';
import { RouterService } from '@rabjs/router';

function App() {
  const countService = useService(CountService);
  const previous = usePrevious(countService);
  const routerService = useService(RouterService);
  console.log('App render', previous, previous === countService);
  return (
    <div className="App">
      <div>
        <button onClick={() => countService.add(1)}>click </button>
        <p>count: {countService.count}</p>
        <p>path: {routerService.location.pathname}</p>
      </div>
      <div>
        <Link to="/demo1">demo1</Link>
        <Link to="/demo2">demo2</Link>
      </div>
      <Switch>
        <Route
          path="/demo1"
          render={() => {
            return <Demo c={'133'} />;
          }}
        />
        <Route path="/demo2" component={DemoFC} />
      </Switch>
    </div>
  );
}

export default view(App);
