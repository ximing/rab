import 'reflect-metadata';
import { Menu } from 'antd';
import './App.css';
import { view, useService } from '@rabjs/core';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { CountService } from './count';
import { DemoFC } from './modules/demo/demoFC';
import { Home } from './modules/home';
import { useEffect } from 'react';

function App() {
  const countService = useService(CountService);
  const location = useLocation();

  useEffect(() => {
    if (countService.count % 2 === 0) {
      countService.add(1);
    }
  }, [countService.count]);

  return (
    <div className="app">
      <div className="nav">
        <Menu
          style={{ width: 220 }}
          onChange={() => {}}
          selectedKeys={[location.pathname]}
          mode="inline"
        >
          <Menu.Item key="/" title={'home'}>
            <Link to="/">home</Link>
          </Menu.Item>
          <Menu.Item key="/demofc" title={'demofc'}>
            <Link to="/demofc">demofc</Link>
          </Menu.Item>
        </Menu>
      </div>
      <div className="content">
        <Routes>
          <Route path="/demofc" Component={DemoFC} />
          <Route path="/" Component={Home} />
        </Routes>
      </div>
    </div>
  );
}

export default view(App);
