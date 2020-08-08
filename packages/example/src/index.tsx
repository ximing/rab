import 'antd/dist/antd.css';
import 'antd/dist/antd.compact.css';
// import 'antd/dist/antd.dark.css';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { Router } from 'react-router-dom';
import App from './App';
import { history } from './router';
// import { observe, observable, isObservable } from '@rabjs/observer-util';
// (() => {
//   class CountModel {
//     count = 0;
//     profile = {
//       firstName: 'Bob',
//       lastName: 'Smith'
//     };
//
//     self = () => {
//       this.count += 1;
//       return this;
//     };
//
//     self1() {
//       this.count += 1;
//       return this;
//     }
//   }
//   console.log('&&&');
//   const m1 = new CountModel();
//   const m2 = observable(m1);
//   console.log('{a:1}', observable({ a: 1 }));
//   console.log(m1, m2, isObservable(m1), isObservable(m2));
//   observe(() => console.log('-->', m2.count));
//   (window as any).observe = observe;
//   (window as any).observable = observable;
//   (window as any).m1 = m1;
//   (window as any).m2 = m2;
// })();
//
ReactDOM.render(
  <Router history={history}>
    <App />
  </Router>,
  document.getElementById('root')
);
