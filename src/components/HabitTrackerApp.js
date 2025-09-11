import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import WeeklyHabitTracker from './WeeklyHabitTracker';
import PredefinedHabits from './PredefinedHabits';
import Leaderboard from './Leaderboard';
import UserProfileViewer from './UserProfileViewer';
import GamePlanningApp from './GamePlanningApp';
import ContactManagementPage from './ContactManagementPage';


const HabitTrackerApp = () => {
  const [user] = useAuthState(auth);
  const [currentView, setCurrentView] = useState('dashboard');
  const [userHabits, setUserHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  const loadUserHabits = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const habitsQuery = query(
        collection(db, 'habits'),
        where('userId', '==', user.uid)
      );
      const habitsSnapshot = await getDocs(habitsQuery);
      
      const habits = habitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUserHabits(habits);
    } catch (error) {
      console.error('Error loading habits:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserHabits();
    }
  }, [user, loadUserHabits]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
      alert('Failed to sign in. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleViewUserProfile = (userId, userName) => {
    setViewingUser({ userId, userName });
  };

  const handleCloseUserProfile = () => {
    setViewingUser(null);
  };

  const handleSignOut = () => {
    auth.signOut();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🎯 Habit Tracker
          </h1>
          <p className="text-gray-600 mb-8">
            Build better habits, compete with friends, track your progress
          </p>
          <button 
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
          >
            {signingIn ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing In...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign In with Google
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center">
                <span className="mr-2">🎯</span>
                Habit Tracker
              </h1>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
             <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-2 sm:px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base whitespace-nowrap ${
                  currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">📊 </span>Dashboard
              </button>
              <button
                onClick={() => setCurrentView('addHabits')}
                className={`px-2 sm:px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base whitespace-nowrap ${
                  currentView === 'addHabits' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">➕ </span>Add Habits
              </button>
               <button
                  onClick={() => setCurrentView('gamePlanning')}
                  className={`px-2 sm:px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base whitespace-nowrap ${
                    currentView === 'gamePlanning' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="hidden sm:inline">🎯 </span>Game Planning
                </button>
                <button
                  onClick={() => setCurrentView('contacts')}
                  className={`px-2 sm:px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base whitespace-nowrap ${
                    currentView === 'contacts' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="hidden sm:inline">📞 </span>Contacts
                </button>
              <button
                onClick={() => setCurrentView('leaderboard')}
                className={`px-2 sm:px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base whitespace-nowrap ${
                  currentView === 'leaderboard' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">🏆 </span>Leaderboard
              </button>
              
              {/* User Menu */}
              <div className="flex items-center ml-2 sm:ml-4 border-l border-gray-200 pl-2 sm:pl-4">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
                  />
                  <span className="hidden md:block text-xs sm:text-sm text-gray-700 max-w-20 lg:max-w-none truncate">
                    {user.displayName}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-4 sm:py-6 px-3 sm:px-4 lg:px-6">
        {currentView === 'dashboard' && (
          <div className="max-w-7xl mx-auto">
            {/* Quick Stats Header */}
            <div className="mb-6 sm:mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
                  <div className="flex items-center">
                    <div className="text-2xl sm:text-3xl mr-3 sm:mr-4">🎯</div>
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">
                        {userHabits.filter(h => !h.isCustom).length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">Scoring Habits</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
                  <div className="flex items-center">
                    <div className="text-2xl sm:text-3xl mr-3 sm:mr-4">⭐</div>
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">
                        {userHabits.filter(h => h.isCustom).length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">Custom Habits</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center">
                    <div className="text-2xl sm:text-3xl mr-3 sm:mr-4">🔥</div>
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">
                        {userHabits.length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">Total Habits</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Habit Tracker */}
            <div className="w-full overflow-x-auto">
              <WeeklyHabitTracker 
                habits={userHabits} 
                onRefreshHabits={loadUserHabits}
              />
            </div>
          </div>
        )}

        {currentView === 'addHabits' && (
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
                Add New Habits
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                Choose from predefined habits that contribute to your score, or create custom personal habits
              </p>
            </div>

            {/* Predefined Habits Component */}
            <PredefinedHabits onHabitAdded={loadUserHabits} />

            {/* Current Habits Summary */}
            {userHabits.length > 0 && (
              <div className="mt-8">
                <div className="bg-white rounded-lg border p-4 sm:p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-4">Your Current Habits</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userHabits.map(habit => (
                      <div key={habit.id} className={`flex items-center p-3 rounded-lg ${
                        habit.isCustom ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                      } border`}>
                        <span className="text-xl mr-3">{habit.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-800 truncate">{habit.name}</div>
                          <div className="text-sm text-gray-500 truncate">
                            {habit.isCustom ? 'Custom habit' : `${habit.category} • Scoring habit`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'leaderboard' && (
          <div className="max-w-6xl mx-auto">
            <Leaderboard onViewUserProfile={handleViewUserProfile} />
          </div>
        )}
        {currentView === 'gamePlanning' && (
                  <div className="max-w-6xl mx-auto">
                    {/* Page Header */}
                    <div className="mb-6">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
                        Game Planning Session
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600">
                        Set monthly goals, track weekly progress, and manage upline relationships
                      </p>
                    </div>

                    {/* Game Planning Component */}
                    <GamePlanningApp user={user} onRefreshData={loadUserHabits} />
                  </div>
                )}
        {currentView === 'contacts' && (
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
                Contact Management
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                Track prospects through your sales pipeline
              </p>
            </div>

            {/* Contact Management Component */}
            <ContactManagementPage user={user} />
          </div>
        )}        

        {/* Welcome Message for New Users */}
        {!loading && userHabits.length === 0 && currentView === 'dashboard' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8 sm:py-12 bg-white rounded-lg border shadow-sm">
              <div className="text-4xl sm:text-6xl mb-4">🎯</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
                Welcome to Habit Tracker!
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto px-4">
                Start building better habits today. Add some predefined habits to begin scoring points 
                and competing on the leaderboard!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
                <button
                  onClick={() => setCurrentView('addHabits')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                >
                  Add Your First Habits
                </button>
                <button
                  onClick={() => setCurrentView('leaderboard')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  View Leaderboard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* User Profile Viewer Modal */}
      {viewingUser && (
        <UserProfileViewer
          userId={viewingUser.userId}
          userName={viewingUser.userName}
          onClose={handleCloseUserProfile}
        />
      )}

      {/* Loading State */}
      {loading && currentView === 'dashboard' && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex items-center shadow-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-700">Loading your habits...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitTrackerApp;