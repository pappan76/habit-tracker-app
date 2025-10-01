import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
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
import AudioHabitCard from './AudioHabitCard';
import BudgetExpensesTracker from './BudgetExpensesTracker';
import InventoryPage from './InventoryPage';
import AnnouncementBadge from './AnnouncementBadge';
import AnnouncementDisplay from './AnnouncementDisplay';
import AnnouncementAdmin from './AnnouncementAdmin';
import { Menu, X, Home, Bell, Target, Phone, Mic, DollarSign, Trophy, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AnnouncementAdmin Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-bold">Error in AnnouncementAdmin:</h2>
          <p className="text-red-600">{this.state.error?.toString()}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const HabitTrackerApp = () => {
  const [user] = useAuthState(auth);
  const { ensureUserDocumentExists, isAdmin, userProfile } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [userHabits, setUserHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  console.log('HabitTrackerApp render - Debug values:', {
    user: user?.email,
    isAdmin,
    userProfile: userProfile ? 'exists' : 'null',
    currentView,
    userHabitsLength: userHabits.length
  });

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

  useEffect(() => {
    if (user?.uid) {
      ensureUserDocumentExists(user);
    }
  }, [user, ensureUserDocumentExists]);

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

  const handleNavClick = (viewId) => {
    setCurrentView(viewId);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'announcements', label: 'Announcements', icon: Bell, hasBadge: true },
    { id: 'gamePlanning', label: 'Game Planning', icon: Target },
    { id: 'contacts', label: 'Contacts', icon: Phone },
    { id: 'audio', label: 'Audio Habits', icon: Mic },
    { id: 'budgeting', label: 'Budgeting', icon: DollarSign },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-10 max-w-md w-full border border-gray-100">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Habit Tracker
          </h1>
          <p className="text-gray-600 mb-8 text-lg">
            Build better habits, compete with friends, track your progress
          </p>
          <button 
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold"
          >
            {signingIn ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Signing In...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}>
        {/* Logo & Toggle */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-xl">🎯</span>
                </div>
                <span className="font-bold text-gray-900">Habit Tracker</span>
              </div>
            )}
            {!sidebarOpen && (
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md mx-auto">
                <span className="text-xl">🎯</span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${!sidebarOpen && 'mx-auto mt-2'}`}
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={!sidebarOpen ? item.label : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="font-medium">{item.label}</span>
                    {item.hasBadge && <AnnouncementBadge user={user} />}
                  </>
                )}
                {!sidebarOpen && item.hasBadge && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-gray-200">
          <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'} px-3 py-3 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer`}>
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-9 h-9 rounded-full ring-2 ring-gray-200 flex-shrink-0"
            />
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {typeof user.displayName === 'string' ? user.displayName : user.email}
                </div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </div>
            )}
          </div>
          {isAdmin && sidebarOpen && (
            <button
              onClick={() => handleNavClick('announcement-admin')}
              className="w-full flex items-center space-x-3 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors mt-1"
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">Manage Announcements</span>
            </button>
          )}
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'} px-3 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-1`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-xl">🎯</span>
              </div>
              <span className="font-bold text-gray-900">Habit Tracker</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-bold text-gray-900 text-lg">Menu</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl mb-6">
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-12 h-12 rounded-full ring-2 ring-gray-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {typeof user.displayName === 'string' ? user.displayName : user.email}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                </div>

                <nav className="space-y-1 mb-6">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium flex-1 text-left">{item.label}</span>
                        {item.hasBadge && <AnnouncementBadge user={user} />}
                      </button>
                    );
                  })}
                </nav>

                {isAdmin && (
                  <button
                    onClick={() => handleNavClick('announcement-admin')}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors mb-2"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Manage Announcements</span>
                  </button>
                )}

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors border-t pt-6"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {currentView === 'dashboard' && (
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <div className="text-3xl mr-4">🎯</div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {userHabits.filter(h => !h.isCustom).length}
                        </div>
                        <div className="text-sm text-gray-600">Scoring Habits</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <div className="text-3xl mr-4">⭐</div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {userHabits.filter(h => h.isCustom).length}
                        </div>
                        <div className="text-sm text-gray-600">Custom Habits</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center">
                      <div className="text-3xl mr-4">🔥</div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {userHabits.length}
                        </div>
                        <div className="text-sm text-gray-600">Total Habits</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Add New Habits</h2>
                <p className="text-gray-600">
                  Choose from predefined habits that contribute to your score, or create custom personal habits
                </p>
              </div>

              <PredefinedHabits onHabitAdded={loadUserHabits} />

              {userHabits.length > 0 && (
                <div className="mt-8">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">Your Current Habits</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userHabits.map(habit => (
                        <div key={habit.id} className={`flex items-center p-4 rounded-xl ${
                          habit.isCustom ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                        } border`}>
                          <span className="text-2xl mr-3">{habit.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">
                              {typeof habit.name === 'string' ? habit.name : 'Unnamed Habit'}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              {habit.isCustom ? 'Custom habit' : `${habit.category || 'Unknown'} • Scoring habit`}
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

          {currentView === 'announcements' && (
            <div className="max-w-7xl mx-auto">
              <AnnouncementDisplay user={user} />
            </div>
          )}
          
          {currentView === 'announcement-admin' && isAdmin && (
            <div className="max-w-7xl mx-auto">
              <ErrorBoundary>
                <AnnouncementAdmin user={user} />
              </ErrorBoundary>
            </div>
          )}

          {currentView === 'audio' && (
            <div className="max-w-7xl mx-auto">
              <AudioHabitCard user={user} />
            </div>
          )}

          {currentView === 'budgeting' && (
            <BudgetExpensesTracker 
              user={user} 
              onRefreshData={loadUserHabits}
              onCancel={() => setCurrentView('dashboard')}
            />
          )}
                    
          {currentView === 'leaderboard' && (
            <div className="max-w-6xl mx-auto">
              <Leaderboard onViewUserProfile={handleViewUserProfile} />
            </div>
          )}

          {currentView === 'gamePlanning' && (
            <div className="max-w-6xl mx-auto">
              <GamePlanningApp user={user} onRefreshData={loadUserHabits} />
            </div>
          )}

          {currentView === 'contacts' && (
            <div className="max-w-7xl mx-auto">
              <ContactManagementPage user={user} />
            </div>
          )}

          {!loading && userHabits.length === 0 && currentView === 'dashboard' && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="text-6xl mb-6">🎯</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Welcome to Habit Tracker!
                </h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto px-4">
                  Start building better habits today. Add some predefined habits to begin scoring points 
                  and competing on the leaderboard!
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
                  <button
                    onClick={() => setCurrentView('addHabits')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold shadow-md hover:shadow-lg"
                  >
                    Add Your First Habits
                  </button>
                  <button
                    onClick={() => setCurrentView('leaderboard')}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold shadow-sm"
                  >
                    View Leaderboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {viewingUser && (
        <UserProfileViewer
          userId={viewingUser.userId}
          userName={viewingUser.userName}
          onClose={handleCloseUserProfile}
        />
      )}

      {loading && currentView === 'dashboard' && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex items-center shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-700 font-medium">Loading your habits...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitTrackerApp;