import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// globals.css explicitly removed to prevent canvas style conflicts!
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
