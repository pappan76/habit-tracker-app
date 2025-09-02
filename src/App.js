import React from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import HabitList from './components/HabitList';
import './App.css';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      {user ? <HabitList /> : <Login />}
    </div>
  );
}

export default App;