import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';

import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { StrictMode } from 'react';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ConfigProvider theme={{ token: {}, cssVar: true, hashed: false }} locale={zhCN}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>
);

// ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
//   <ConfigProvider theme={{ token: {}, cssVar: true, hashed: false }} locale={zhCN}>
//     <BrowserRouter>
//       <App />
//     </BrowserRouter>
//   </ConfigProvider>
// );
