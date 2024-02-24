import 'reflect-metadata';
import { Menu } from 'antd';
import './App.css';
import { view, useService } from '@rabjs/core';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { CountService } from './count';
import { Demo } from './modules/demo/demo';
import { DemoFC } from './modules/demo/demoFC';
import { Home } from './modules/home';

function App() {
  const countService = useService(CountService);
  // const previous = usePrevious(countService);
  const location = useLocation();
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
          selectedKeys={[location.pathname]}
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
        <Routes>
          <Route path="/demo1" element={<Demo c={'133'} />} />
          <Route path="/demo2" Component={DemoFC} />
          <Route path="/" Component={Home} />
        </Routes>
      </div>
    </div>
  );
}

export default view(App);
