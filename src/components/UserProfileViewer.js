import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  getCustomWeekDates, 
  getWeekRangeString, 
  getPreviousWeek, 
  getNextWeek, 
  isCurrentWeek, 
  isToday, 
  formatDateString,
  CUSTOM_WEEK_DAYS 
} from '../utils/weekUtils';

const UserProfileViewer = ({ userId, userName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [userHabits, setUserHabits] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [completedHabits, setCompletedHabits] = useState({});
  const [habitValues, setHabitValues] = useState({});

  const weekDates = getCustomWeekDates(currentWeek);
  const weekRange = getWeekRangeString(currentWeek);

  // Separate scoring and custom habits (only show scoring habits to others)
  const scoringHabits = userHabits.filter(habit => !habit.isCustom);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      loadUserHabits();
    }
  }, [userId]);

  useEffect(() => {
    if (userHabits.length > 0) {
      loadWeeklyProgress();
    }
  }, [userHabits, currentWeek]);

  const loadUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile({
          ...userData,
          id: userId
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadUserHabits = async () => {
    try {
      const habitsQuery = query(
        collection(db, 'habits'),
        where('userId', '==', userId),
        where('isCustom', '!=', true) // Only show scoring habits
      );
      const habitsSnapshot = await getDocs(habitsQuery);
      
      const habits = habitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUserHabits(habits);
    } catch (error) {
      console.error('Error loading user habits:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyProgress = async () => {
    try {
      const habitProgress = {};
      const habitNumberValues = {};
      
      for (const habit of userHabits) {
        const completedDates = habit.completedDates || [];
        const completedValues = habit.completedValues || {};
        
        weekDates.forEach(date => {
          const dateString = formatDateString(date);
          const key = `${habit.id}-${dateString}`;
          
          if (habit.type === 'number') {
            const value = completedValues[dateString] || 0;
            habitNumberValues[key] = value;
            habitProgress[key] = value >= (habit.target || 1);
          } else {
            habitProgress[key] = completedDates.includes(dateString);
          }
        });
      }
      
      setCompletedHabits(habitProgress);
      setHabitValues(habitNumberValues);
    } catch (error) {
      console.error('Error loading weekly progress:', error);
    }
  };

  const getCompletionPercentage = (habit) => {
    let completed = 0;
    weekDates.forEach(date => {
      const dateString = formatDateString(date);
      const key = `${habit.id}-${dateString}`;
      if (completedHabits[key]) completed++;
    });
    return Math.round((completed / 7) * 100);
  };

  const getDailyScore = (date) => {
    const dateString = formatDateString(date);
    let score = 0;
    
    scoringHabits.forEach(habit => {
      const key = `${habit.id}-${dateString}`;
      
      if (habit.type === 'number') {
        const value = habitValues[key] || 0;
        score += value;
      } else {
        if (completedHabits[key]) {
          score += 1;
        }
      }
    });
    
    return score;
  };

  const getWeeklyScore = () => {
    let totalScore = 0;
    weekDates.forEach(date => {
      totalScore += getDailyScore(date);
    });
    return totalScore;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-90vh overflow-y-auto">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading {userName}'s habits...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-90vh overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl mr-3">{userProfile?.avatar || '👤'}</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {userProfile?.displayName || userName}'s Habits
              </h1>
              <p className="text-sm text-gray-600">
                Member since {userProfile?.joinedAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold px-2"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentWeek(getPreviousWeek(currentWeek))}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              <span className="mr-1">←</span>
              Previous
            </button>
            
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-800">
                Week of {weekRange}
              </h2>
              {isCurrentWeek(currentWeek) && (
                <span className="text-xs text-blue-600 font-medium">Current Week</span>
              )}
            </div>
            
            <button
              onClick={() => setCurrentWeek(getNextWeek(currentWeek))}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              Next
              <span className="ml-1">→</span>
            </button>
          </div>

          {/* Current Week Button */}
          {!isCurrentWeek(currentWeek) && (
            <div className="flex justify-center mb-4">
              <button
                onClick={() => setCurrentWeek(new Date())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                View Current Week
              </button>
            </div>
          )}

          {/* User's Weekly Score */}
          <div className="mb-6 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">
                  📊 {userProfile?.displayName || userName}'s Score
                </h3>
                <div className="text-3xl font-bold">{getWeeklyScore()} Points</div>
                <div className="text-green-100 mt-1">
                  Week of {weekRange}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{scoringHabits.length}</div>
                <div className="text-green-100 text-sm">Active Habits</div>
              </div>
            </div>
            
            {/* Daily breakdown */}
            <div className="mt-4 pt-4 border-t border-green-400">
              <div className="grid grid-cols-7 gap-2 text-center">
                {weekDates.map((date, index) => {
                  const dailyScore = getDailyScore(date);
                  
                  return (
                    <div key={date.toISOString()} className="bg-white bg-opacity-20 rounded-lg p-2">
                      <div className="text-xs font-medium">
                        {CUSTOM_WEEK_DAYS[index].short}
                      </div>
                      <div className="text-lg font-bold">
                        {dailyScore}
                      </div>
                      <div className="text-xs opacity-80">
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Habits Tracker */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-9 bg-gray-50 border-b">
              <div className="p-3 font-semibold text-gray-700 text-sm">Habits</div>
              {weekDates.map((date, index) => (
                <div key={date.toISOString()} className="p-3 text-center">
                  <div className="font-semibold text-gray-700 text-sm">
                    {CUSTOM_WEEK_DAYS[index].short}
                  </div>
                  <div className={`text-xs mt-1 ${
                    isToday(date) ? 'text-blue-600 font-bold' : 'text-gray-500'
                  }`}>
                    {date.getDate()}
                  </div>
                  {isToday(date) && (
                    <div className="w-1 h-1 bg-blue-600 rounded-full mx-auto mt-1"></div>
                  )}
                  <div className="text-xs text-green-600 font-semibold mt-1">
                    {getDailyScore(date)} pts
                  </div>
                </div>
              ))}
              <div className="p-3 text-center bg-blue-50 border-l">
                <div className="font-semibold text-blue-700 text-sm">Total</div>
                <div className="text-lg font-bold text-blue-700 mt-1">
                  {getWeeklyScore()}
                </div>
              </div>
            </div>

            {/* Habit Rows */}
            {scoringHabits.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-4">🤷</div>
                <p className="text-lg font-medium">{userProfile?.displayName || userName} hasn't shared any habits yet</p>
                <p className="text-sm mt-2">Only scoring habits are visible to other users</p>
              </div>
            ) : (
              scoringHabits.map((habit) => (
                <div key={habit.id} className="grid grid-cols-9 border-b last:border-b-0 hover:bg-gray-50">
                  <div className="p-3 flex items-center">
                    <span className="text-lg mr-2">{habit.icon}</span>
                    <div>
                      <div className="font-medium text-gray-800 text-sm">
                        {habit.name}
                      </div>
                      {habit.type === 'number' && (
                        <div className="text-xs text-gray-500">
                          Target: {habit.target} {habit.unit}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {getCompletionPercentage(habit)}% this week
                      </div>
                    </div>
                  </div>
                  
                  {weekDates.map((date) => {
                    const dateString = formatDateString(date);
                    const key = `${habit.id}-${dateString}`;
                    const isCompleted = completedHabits[key];
                    const isDateToday = isToday(date);
                    const currentValue = habitValues[key] || 0;
                    
                    return (
                      <div key={dateString} className="p-3 flex items-center justify-center">
                        {habit.type === 'number' ? (
                          <div className="flex flex-col items-center">
                            <div className={`w-10 h-6 text-center text-sm border rounded flex items-center justify-center ${
                              isCompleted
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : isDateToday
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-300 bg-gray-50'
                            }`}>
                              {currentValue}
                            </div>
                            {isCompleted && (
                              <div className="text-green-500 text-xs mt-1">✓</div>
                            )}
                          </div>
                        ) : (
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isCompleted
                              ? 'bg-green-500 border-green-500 text-white'
                              : isDateToday
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-gray-300 bg-gray-50'
                          }`}>
                            {isCompleted && <span className="text-xs">✓</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Weekly total for this habit */}
                  <div className="p-3 text-center bg-gray-50 border-l">
                    <div className="text-sm font-medium text-gray-700">
                      {habit.type === 'number' ? (
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (habitValues[key] || 0);
                        }, 0)
                      ) : (
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (completedHabits[key] ? 1 : 0);
                        }, 0)
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {habit.type === 'number' ? habit.unit : 'days'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* User's Week Summary */}
          {scoringHabits.length > 0 && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                📈 {userProfile?.displayName || userName}'s Week Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {scoringHabits.map(habit => {
                  const percentage = getCompletionPercentage(habit);
                  const weeklyTotal = habit.type === 'number' ? 
                    weekDates.reduce((sum, date) => {
                      const key = `${habit.id}-${formatDateString(date)}`;
                      return sum + (habitValues[key] || 0);
                    }, 0) :
                    weekDates.reduce((sum, date) => {
                      const key = `${habit.id}-${formatDateString(date)}`;
                      return sum + (completedHabits[key] ? 1 : 0);
                    }, 0);
                  
                  return (
                    <div key={habit.id} className="text-center bg-white rounded-lg p-3 border">
                      <div className="text-xl mb-1">{habit.icon}</div>
                      <div className="text-sm font-medium text-gray-700">{habit.name}</div>
                      <div className={`text-lg font-bold ${
                        percentage >= 80 ? 'text-green-600' : 
                        percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {weeklyTotal} {habit.type === 'number' ? 'pts' : 'days'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {percentage}% completed
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inspirational Note */}
          <div className="mt-6 text-center">
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-4 border border-purple-200">
              <div className="text-2xl mb-2">👏</div>
              <p className="text-gray-700">
                <strong>{userProfile?.displayName || userName}</strong> is building great habits!
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Get inspired and start your own habit tracking journey
              </p>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>🔒 Only scoring habits are visible • Custom personal habits remain private</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileViewer;