import 'reflect-metadata';
import React from 'react';
import { Menu } from 'antd';
import './App.css';
import { view, useService } from '@rabjs/core';
import { Link, Switch, Route } from 'react-router-dom';
import { RouterService } from '@rabjs/router';
import { CountService } from './count';
import { Demo } from './modules/demo/demo';
import { DemoFC } from './modules/demo/demoFC';
import { Home } from './modules/home';

function App() {
  const countService = useService(CountService);
  // const previous = usePrevious(countService);
  const routerService = useService(RouterService);
  if (countService.count % 2 === 0) {
    countService.add(1);
  }
  // console.log('App render', previous, previous === countService, countService.count);
  return (
    <div className="app">
      <div className="nav">
        <Menu
          style={{ width: 220 }}
          onChange={() => {}}
          selectedKeys={[routerService.location.pathname]}
          mode="inline"
        >
          <Menu.Item key="/" title={'home'}>
            <Link to="/">home</Link>
          </Menu.Item>
          <Menu.Item key="/demo1" title={'demo1'}>
            <Link to="/demo1">demo1</Link>
          </Menu.Item>
          <Menu.Item key="/demo2" title={'demo2'}>
            <Link to="/demo2">demo2</Link>
          </Menu.Item>
        </Menu>
      </div>
      <div className="content">
        <Switch>
          <Route
            path="/demo1"
            render={() => {
              return <Demo c={'133'} />;
            }}
          />
          <Route path="/demo2" component={DemoFC} />
          <Route path="/" component={Home} />
        </Switch>
      </div>
    </div>
  );
}

export default view(App);
