import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import HabitTrackerApp from './components/HabitTrackerApp';
import './styles/mobile.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HabitTrackerApp />
  </React.StrictMode>
);
