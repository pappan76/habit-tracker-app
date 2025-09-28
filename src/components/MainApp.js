import React, { useState } from 'react';
import HabitList from './HabitList';
import ContactManagementPage from './ContactManagementPage';
import AudioHabitCard, { WeeklyFeaturedAudios } from './AudioHabitCard';
import GamePlanningApp from './GamePlanningApp';
import InventoryPage from './InventoryPage'; // New InventoryPage component
import Leaderboard from './Leaderboard';
import BudgetExpensesTracker from './BudgetExpensesTracker'; // New BudgetExpensesTracker component


const MainApp = ({ user }) => {
  const [currentView, setCurrentView] = useState('habits');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-gray-800">
                Habit Tracker
              </h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setCurrentView('habits')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  currentView === 'habits' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Habits
              </button>
              <button
                onClick={() => setCurrentView('contacts')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  currentView === 'contacts' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Contacts
              </button>
              <button
                onClick={() => setCurrentView('audio')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  currentView === 'audio' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Audio Habits
              </button>
              <button
                onClick={() => setCurrentView('gamePlanning')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  currentView === 'gamePlanning' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Game Planning
              </button>
              <button
                onClick={() => setCurrentView('budgeting')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  currentView === 'budgeting' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Budgeting
              </button>
              <button
                onClick={() => setCurrentView('inventory')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  currentView === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                InventoryPage
              </button>
              <button
                onClick={() => setCurrentView('leaderboard')}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  currentView === 'leaderboard' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6">
        {currentView === 'habits' && <HabitList />}
        {currentView === 'contacts' && <ContactManagementPage user={user} />}
        {currentView === 'audio' && (
          <>
            <AudioHabitCard />
            <WeeklyFeaturedAudios />
          </>
        )}        
        {currentView === 'gamePlanning' && <GamePlanningApp />}
        <button
          onClick={() => setCurrentView('inventory')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
            currentView === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Inventory
        </button>        {currentView === 'leaderboard' && <Leaderboard />}
        {currentView === 'budgeting' && <BudgetExpensesTracker />} {/* New BudgetExpensesTracker component */}   
      </main>
    </div>
  );
};

export default MainApp;