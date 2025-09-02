import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import WeeklyHabitTracker from './WeeklyHabitTracker';
import PredefinedHabits from './PredefinedHabits';
import Leaderboard from './Leaderboard';
import UserProfileViewer from './UserProfileViewer';

const HabitTrackerApp = () => {
  const [user] = useAuthState(auth);
  const [currentView, setCurrentView] = useState('dashboard');
  const [userHabits, setUserHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false); // Add loading state for sign in

  useEffect(() => {
    if (user) {
      loadUserHabits();
    }
  }, [user]);

  const loadUserHabits = async () => {
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
  };

  // Add Google Sign In function
  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // User state will be automatically updated by useAuthState hook
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
      // Update your navigation section
      <nav className="bg-white shadow-sm border-b habit-tracker-nav">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center">
                <span className="mr-2">🎯</span>
                Habit Tracker
              </h1>
            </div>
            
            <div className="nav-buttons">
              <button
                onClick={() => setCurrentView('dashboard')}
                data-emoji="📊"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setCurrentView('addHabits')}
                data-emoji="➕"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'addHabits' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>Add Habits</span>
              </button>
              <button
                onClick={() => setCurrentView('leaderboard')}
                data-emoji="🏆"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'leaderboard' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>Leaderboard</span>
              </button>
            </div>
            
            {/* Rest of navigation */}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6">
        {currentView === 'dashboard' && (
          <div>
            {/* Quick Stats Header */}
            <div className="quick-stats">
              <div className="quick-stat-card bg-white rounded-lg p-6 border">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <div className="quick-stat-icon text-3xl mr-4">🎯</div>
                    <div>
                      <div className="quick-stat-number text-2xl font-bold text-gray-800">
                        {userHabits.filter(h => !h.isCustom).length}
                      </div>
                      <div className="quick-stat-label text-sm text-gray-600">Scoring Habits</div>
                    </div>
                  </div>
                </div>
                
                <div className="quick-stat-card bg-white rounded-lg p-6 border">
                  <div className="flex items-center">
                    <div className="quick-stat-icon text-3xl mr-4">⭐</div>
                    <div>
                      <div className="quick-stat-number text-2xl font-bold text-gray-800">
                        {userHabits.filter(h => h.isCustom).length}
                      </div>
                      <div className="quick-stat-label text-sm text-gray-600">Custom Habits</div>
                    </div>
                  </div>
                </div>
                
                <div className="quick-stat-card bg-white rounded-lg p-6 border">
                  <div className="flex items-center">
                    <div className="quick-stat-icon text-3xl mr-4">🔥</div>
                    <div>
                      <div className="quick-stat-number text-2xl font-bold text-gray-800">
                        {userHabits.length}
                      </div>
                      <div className="quick-stat-label text-sm text-gray-600">Total Habits</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Habit Tracker */}
            <WeeklyHabitTracker 
              habits={userHabits} 
              onRefreshHabits={loadUserHabits}
            />
          </div>
        )}

        {currentView === 'addHabits' && (
          <div>
            {/* Page Header */}
            <div className="max-w-4xl mx-auto px-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Add New Habits
              </h2>
              <p className="text-gray-600">
                Choose from predefined habits that contribute to your score, or create custom personal habits
              </p>
            </div>

            {/* Predefined Habits Component */}
            <PredefinedHabits onHabitAdded={loadUserHabits} />

            {/* Current Habits Summary */}
            {userHabits.length > 0 && (
              <div className="max-w-4xl mx-auto px-6 mt-8">
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Your Current Habits</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userHabits.map(habit => (
                      <div key={habit.id} className={`flex items-center p-3 rounded-lg ${
                        habit.isCustom ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                      } border`}>
                        <span className="text-xl mr-3">{habit.icon}</span>
                        <div>
                          <div className="font-medium text-gray-800">{habit.name}</div>
                          <div className="text-sm text-gray-500">
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
          <Leaderboard onViewUserProfile={handleViewUserProfile} />
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
          <div className="bg-white rounded-lg p-6 flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-700">Loading your habits...</span>
          </div>
        </div>
      )}

      {/* Welcome Message for New Users */}
      {!loading && userHabits.length === 0 && currentView === 'dashboard' && (
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center py-12 bg-white rounded-lg border">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Welcome to Habit Tracker!
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start building better habits today. Add some predefined habits to begin scoring points 
              and competing on the leaderboard!
            </p>
            <div className="space-x-4">
              <button
                onClick={() => setCurrentView('addHabits')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Your First Habits
              </button>
              <button
                onClick={() => setCurrentView('leaderboard')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitTrackerApp;