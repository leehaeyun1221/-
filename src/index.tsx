import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // 여기서 ./App은 같은 폴더의 App.tsx를 의미합니다.

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
