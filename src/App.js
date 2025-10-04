import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import MainApp from './components/MainApp';
import './App.css';
import './styles/responsive.css';
import './styles/mobile.css';
import { updateHabitNames } from './utils/updateHabits';
import InventoryPage from './components/InventoryPage';
import { testGeminiConnection } from './services/aiService';


function App() {
  const { user, userProfile, loading } = useAuth();
  useEffect(() => {
    // Test Gemini connection on app startup
    console.log('🔍 Testing Gemini API connection...');
    testGeminiConnection();
  }, []);

  // Run migration when user is authenticated
  useEffect(() => {
    console.log('useEffect triggered, user:', !!user);
    
    if (user) {
      const hasRunMigration = localStorage.getItem('habitNamesUpdated');
      console.log('Migration status:', hasRunMigration);
      
      if (!hasRunMigration) {
        console.log('Starting migration...');
        updateHabitNames().then((result) => {
          console.log('Migration result:', result);
          if (result.success) {
            localStorage.setItem('habitNamesUpdated', 'true');
            console.log('Migration completed successfully');
          } else {
            console.error('Migration failed:', result.error);
          }
        }).catch(error => {
          console.error('Migration error:', error);
        });
      } else {
        console.log('Migration already completed, skipping');
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-600">Loading...</div>
      </div>
    );
  }

return (
  <div className="App">
    {user ? <MainApp user={userProfile || user} /> : <Login />}
  </div>
);
}

export default App;