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
  const scoringHabits = userHabits.filter(habit => habit.isCustom !== true && habit.isCustom !== 'true');

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
        setUserProfile({ ...userDoc.data(), id: userId });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadUserHabits = async () => {
    try {
      const habitsQuery = query(collection(db, 'habits'), where('userId', '==', userId));
      const habitsSnapshot = await getDocs(habitsQuery);
      
      if (habitsSnapshot.empty) {
        setUserHabits([]);
        return;
      }
      
      const allHabits = habitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const scoringHabits = allHabits.filter(habit => habit.isCustom !== true && habit.isCustom !== 'true');
      setUserHabits(scoringHabits);
    } catch (error) {
      console.error('Error loading user habits:', error);
      setUserHabits([]);
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

  const getDailyScore = (date) => {
    const dateString = formatDateString(date);
    let score = 0;
    
    scoringHabits.forEach(habit => {
      const key = `${habit.id}-${dateString}`;
      if (habit.type === 'number') {
        score += habitValues[key] || 0;
      } else {
        if (completedHabits[key]) score += 1;
      }
    });
    
    return score;
  };

  const getWeeklyScore = () => {
    return weekDates.reduce((total, date) => total + getDailyScore(date), 0);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-4 w-full max-w-sm">
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1">
      <div className="bg-white rounded-lg w-full max-w-md max-h-screen overflow-y-auto">
        
        {/* Ultra Compact Header */}
        <div className="sticky top-0 bg-white border-b px-3 py-2 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-lg mr-2">{userProfile?.avatar || '👤'}</span>
            <div>
              <h1 className="font-bold text-gray-800 text-xs">
                {userProfile?.displayName || userName}
              </h1>
              <p className="text-xs text-gray-500">
                {getWeeklyScore()} pts • {scoringHabits.length} habits
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="p-3">
          
          {/* Mini Week Navigation */}
          <div className="flex items-center justify-between mb-3 text-xs">
            <button
              onClick={() => setCurrentWeek(getPreviousWeek(currentWeek))}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded text-xs"
            >
              ← Prev
            </button>
            
            <div className="text-center">
              <div className="font-medium text-gray-800 text-xs">{weekRange.split(' - ')[0]}</div>
              {isCurrentWeek(currentWeek) && <span className="text-xs text-blue-600">Current</span>}
            </div>
            
            <button
              onClick={() => setCurrentWeek(getNextWeek(currentWeek))}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded text-xs"
            >
              Next →
            </button>
          </div>

          {/* Current Week Button */}
          {!isCurrentWeek(currentWeek) && (
            <div className="flex justify-center mb-2">
              <button
                onClick={() => setCurrentWeek(new Date())}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
              >
                Current
              </button>
            </div>
          )}

          {/* Mini Score Overview */}
          <div className="mb-3 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded p-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-bold">{getWeeklyScore()} Points</div>
                <div className="text-xs opacity-90">{scoringHabits.length} habits</div>
              </div>
              <div className="flex space-x-1">
                {weekDates.map((date, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xs opacity-75">{CUSTOM_WEEK_DAYS[index].short.charAt(0)}</div>
                    <div className="text-xs font-bold">{getDailyScore(date)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ultra Compact Habits List */}
          {scoringHabits.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <div className="text-xl mb-2">🤷</div>
              <p className="text-xs">No habits to display</p>
            </div>
          ) : (
            <div className="space-y-1">
              {scoringHabits.map((habit) => {
                const weeklyTotal = weekDates.reduce((sum, date) => {
                  const key = `${habit.id}-${formatDateString(date)}`;
                  if (habit.type === 'number') {
                    return sum + (habitValues[key] || 0);
                  } else {
                    return sum + (completedHabits[key] ? 1 : 0);
                  }
                }, 0);

                return (
                  <div key={habit.id} className="bg-gray-50 rounded p-2">
                    
                    {/* Mini Habit Header */}
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center">
                        <span className="text-xs mr-1">{habit.icon}</span>
                        <div className="text-xs font-medium text-gray-800 truncate">{habit.name}</div>
                      </div>
                      <div className="text-xs font-bold text-green-600 ml-2">
                        {weeklyTotal} {habit.type === 'number' ? '' : 'd'}
                      </div>
                    </div>
                    
                    {/* Mini Week Progress */}
                    <div className="flex space-x-1 justify-between">
                      {weekDates.map((date, index) => {
                        const dateString = formatDateString(date);
                        const key = `${habit.id}-${dateString}`;
                        const isCompleted = completedHabits[key];
                        const currentValue = habitValues[key] || 0;
                        const isDateToday = isToday(date);
                        
                        return (
                          <div key={index} className="text-center flex-1">
                            <div className={`text-xs mb-0.5 ${isDateToday ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                              {date.getDate()}
                            </div>
                            
                            {habit.type === 'number' ? (
                              <div className={`text-xs px-0.5 py-0.5 rounded text-center ${
                                isCompleted ? 'bg-green-200 text-green-800' :
                                currentValue > 0 ? 'bg-yellow-200 text-yellow-800' :
                                'bg-gray-200 text-gray-600'
                              }`}>
                                {currentValue}
                              </div>
                            ) : (
                              <div className={`w-3 h-3 rounded-full mx-auto ${
                                isCompleted ? 'bg-green-500' : 'bg-gray-300'
                              }`}>
                                {isCompleted && <div className="text-white text-xs leading-3 text-center">✓</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mini Footer */}
          <div className="mt-3 text-center">
            <div className="bg-purple-50 rounded p-2 border border-purple-200">
              <p className="text-xs text-gray-700">
                <strong>{userProfile?.displayName || userName}</strong> is building habits!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileViewer;