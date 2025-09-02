import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc, where, orderBy } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { getCustomWeekDates, formatDateString, getWeekRangeString } from '../utils/weekUtils';

const Leaderboard = ({ onViewUserProfile }) => {
  const [user] = useAuthState(auth);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState('currentWeek'); // currentWeek, lastWeek, allTime
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
    loadLeaderboard();
  }, [user, timeFrame]);

  const loadUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      } else {
        // Create default profile
        const defaultProfile = {
          displayName: user.displayName || user.email.split('@')[0],
          email: user.email,
          isPublic: true,
          showOnLeaderboard: true,
          avatar: '👤',
          joinedAt: new Date(),
          totalWeeksActive: 0
        };
        await updateDoc(doc(db, 'users', user.uid), defaultProfile);
        setUserProfile(defaultProfile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      // Get all users who want to show on leaderboard
      const usersQuery = query(
        collection(db, 'users'),
        where('showOnLeaderboard', '==', true)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      const leaderboardEntries = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Get user's habits
        const habitsQuery = query(
          collection(db, 'habits'),
          where('userId', '==', userId),
          where('isCustom', '!=', true) // Only scoring habits
        );
        const habitsSnapshot = await getDocs(habitsQuery);
        
        if (habitsSnapshot.empty) continue;
        
        const habits = habitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Calculate score based on timeframe
        let score = 0;
        let weekDates = [];
        
        if (timeFrame === 'currentWeek') {
          weekDates = getCustomWeekDates(new Date());
        } else if (timeFrame === 'lastWeek') {
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          weekDates = getCustomWeekDates(lastWeek);
        } else if (timeFrame === 'allTime') {
          // For all-time, we'll calculate last 4 weeks
          const fourWeeksAgo = new Date();
          fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
          
          for (let i = 0; i < 28; i++) {
            const date = new Date(fourWeeksAgo);
            date.setDate(date.getDate() + i);
            weekDates.push(date);
          }
        }
        
        // Calculate score for the timeframe
        for (const habit of habits) {
          for (const date of weekDates) {
            const dateString = formatDateString(date);
            
            if (habit.type === 'number' && habit.completedValues) {
              const value = habit.completedValues[dateString] || 0;
              score += value;
            } else if (habit.completedDates && habit.completedDates.includes(dateString)) {
              score += 1;
            }
          }
        }
        
        if (score > 0) {
          leaderboardEntries.push({
            userId,
            displayName: userData.displayName || 'Anonymous',
            avatar: userData.avatar || '👤',
            score,
            totalHabits: habits.length,
            joinedAt: userData.joinedAt,
            isCurrentUser: userId === user?.uid
          });
        }
      }
      
      // Sort by score (highest first)
      leaderboardEntries.sort((a, b) => b.score - a.score);
      
      // Add rank
      leaderboardEntries.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      
      setLeaderboardData(leaderboardEntries);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLeaderboardVisibility = async () => {
    if (!user || !userProfile) return;
    
    const newVisibility = !userProfile.showOnLeaderboard;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        showOnLeaderboard: newVisibility
      });
      
      setUserProfile(prev => ({
        ...prev,
        showOnLeaderboard: newVisibility
      }));
      
      // Reload leaderboard
      loadLeaderboard();
    } catch (error) {
      console.error('Error updating leaderboard visibility:', error);
    }
  };

  const getRankEmoji = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getTimeFrameLabel = () => {
    switch (timeFrame) {
      case 'currentWeek': return `Current Week (${getWeekRangeString(new Date())})`;
      case 'lastWeek': 
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        return `Last Week (${getWeekRangeString(lastWeek)})`;
      case 'allTime': return 'Last 4 Weeks';
      default: return 'Current Week';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm sm:text-base">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6">
      {/* Header - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 flex items-center">
          <span className="mr-2 sm:mr-3">🏆</span>
          <span className="hidden sm:inline">Habit Tracker Leaderboard</span>
          <span className="sm:hidden">Leaderboard</span>
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          See how you rank against other habit trackers in the community
        </p>
      </div>

      {/* Time Frame Selector - Mobile Optimized */}
      <div className="mb-4 sm:mb-6 bg-white rounded-lg border p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={() => setTimeFrame('currentWeek')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              timeFrame === 'currentWeek'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeFrame('lastWeek')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              timeFrame === 'lastWeek'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last Week
          </button>
          <button
            onClick={() => setTimeFrame('allTime')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              timeFrame === 'allTime'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 4 Weeks
          </button>
        </div>
        <div className="mt-2 text-xs sm:text-sm text-gray-600">
          Showing: {getTimeFrameLabel()}
        </div>
      </div>

      {/* Privacy Settings - Mobile Optimized */}
      {user && userProfile && (
        <div className="mb-4 sm:mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center">
              <span className="mr-2">👁️</span>
              <div>
                <div className="font-medium text-yellow-800 text-sm sm:text-base">Leaderboard Visibility</div>
                <div className="text-xs sm:text-sm text-yellow-700">
                  {userProfile.showOnLeaderboard 
                    ? "You're visible on the leaderboard" 
                    : "You're hidden from the leaderboard"
                  }
                </div>
              </div>
            </div>
            <button
              onClick={toggleLeaderboardVisibility}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                userProfile.showOnLeaderboard
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {userProfile.showOnLeaderboard ? 'Hide Me' : 'Show Me'}
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {leaderboardData.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <div className="text-3xl sm:text-4xl mb-4">🤷</div>
            <p className="text-base sm:text-lg font-medium">No one on the leaderboard yet</p>
            <p className="text-xs sm:text-sm mt-2">Be the first to start tracking habits and appear here!</p>
          </div>
        ) : (
          <>
            {/* Desktop Header Row */}
            <div className="hidden sm:block bg-gray-50 border-b px-4 sm:px-6 py-4">
              <div className="grid grid-cols-12 gap-4 items-center font-semibold text-gray-700 text-sm">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">User</div>
                <div className="col-span-2">Score</div>
                <div className="col-span-2">Habits</div>
                <div className="col-span-3">Action</div>
              </div>
            </div>

            {/* Leaderboard Entries */}
            {leaderboardData.map((entry, index) => (
              <div
                key={entry.userId}
                className={`border-b last:border-b-0 ${
                  entry.isCurrentUser 
                    ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Desktop Layout */}
                <div className="hidden sm:block px-4 sm:px-6 py-4">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Rank */}
                    <div className="col-span-1">
                      <div className={`text-lg font-bold ${
                        entry.rank <= 3 ? 'text-2xl' : ''
                      }`}>
                        {getRankEmoji(entry.rank)}
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="col-span-4 flex items-center">
                      <span className="text-2xl mr-3">{entry.avatar}</span>
                      <div>
                        <div className={`font-medium ${
                          entry.isCurrentUser ? 'text-blue-700' : 'text-gray-800'
                        }`}>
                          {entry.displayName}
                          {entry.isCurrentUser && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Member since {entry.joinedAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="col-span-2">
                      <div className="text-xl font-bold text-green-600">
                        {entry.score}
                      </div>
                      <div className="text-sm text-gray-500">points</div>
                    </div>

                    {/* Habits Count */}
                    <div className="col-span-2">
                      <div className="text-lg font-medium text-gray-700">
                        {entry.totalHabits}
                      </div>
                      <div className="text-sm text-gray-500">habits</div>
                    </div>

                    {/* Action Button */}
                    <div className="col-span-3">
                      {entry.isCurrentUser ? (
                        <span className="text-sm text-blue-600 font-medium">
                          That's you! 🎉
                        </span>
                      ) : (
                        <button
                          onClick={() => onViewUserProfile && onViewUserProfile(entry.userId, entry.displayName)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          View Habits
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="block sm:hidden p-4">
                  <div className="flex items-center justify-between">
                    {/* Left: Rank + User Info */}
                    <div className="flex items-center flex-1">
                      <div className={`text-2xl font-bold mr-3 ${
                        entry.rank <= 3 ? 'text-3xl' : 'text-xl'
                      }`}>
                        {getRankEmoji(entry.rank)}
                      </div>
                      <div className="flex items-center flex-1">
                        <span className="text-xl mr-2">{entry.avatar}</span>
                        <div>
                          <div className={`font-medium text-sm ${
                            entry.isCurrentUser ? 'text-blue-700' : 'text-gray-800'
                          }`}>
                            {entry.displayName}
                            {entry.isCurrentUser && (
                              <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {entry.totalHabits} habits
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Score + Action */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {entry.score}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">points</div>
                      {entry.isCurrentUser ? (
                        <span className="text-xs text-blue-600 font-medium">
                          You! 🎉
                        </span>
                      ) : (
                        <button
                          onClick={() => onViewUserProfile && onViewUserProfile(entry.userId, entry.displayName)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Fun Stats - Mobile Optimized */}
      {leaderboardData.length > 0 && (
        <div className="mt-4 sm:mt-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold mb-4">🎊 Community Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">
                {leaderboardData.reduce((sum, entry) => sum + entry.score, 0)}
              </div>
              <div className="text-purple-100 text-sm">Total Points Earned</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">{leaderboardData.length}</div>
              <div className="text-purple-100 text-sm">Active Members</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold">
                {Math.round(leaderboardData.reduce((sum, entry) => sum + entry.score, 0) / leaderboardData.length)}
              </div>
              <div className="text-purple-100 text-sm">Average Score</div>
            </div>
          </div>
        </div>
      )}

      {/* Motivational Message - Mobile Optimized */}
      <div className="mt-4 sm:mt-6 text-center">
        <div className="bg-white rounded-lg border p-4 sm:p-6">
          <div className="text-xl sm:text-2xl mb-2">💪</div>
          <h3 className="font-bold text-gray-800 mb-2 text-sm sm:text-base">
            {user && leaderboardData.find(entry => entry.isCurrentUser)
              ? `You're ranked #${leaderboardData.find(entry => entry.isCurrentUser)?.rank}!`
              : 'Join the leaderboard!'
            }
          </h3>
          <p className="text-gray-600 text-xs sm:text-base">
            {user && userProfile?.showOnLeaderboard
              ? "Keep building great habits and climb the ranks!"
              : "Start tracking your habits and compete with the community!"
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;